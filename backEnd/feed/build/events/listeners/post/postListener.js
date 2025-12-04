"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostDeletedListener = exports.PostUpdatedListener = exports.PostCreatedListener = void 0;
const shared_1 = require("@aichatwar/shared");
const fanout_queue_1 = require("../../../queues/fanout-queue");
const post_1 = require("../../../models/post/post");
const queGroupNames_1 = require("./../../queGroupNames");
class PostCreatedListener extends shared_1.Listener {
    constructor() {
        super(...arguments);
        this.topic = shared_1.Subjects.PostCreated;
        this.groupId = queGroupNames_1.GroupIdPostCreated;
    }
    onMessage(data, msg) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('Post created event received:', data);
            const { id, userId, content, mediaIds, media, visibility, createdAt, } = data;
            // Use media from event if available, otherwise fallback to mediaIds
            // Media from event contains id and url (unsigned) as published by media service
            let postMedia = undefined;
            if (media && media.length > 0) {
                // Use media from the event (contains id and url from media service)
                console.log('Using media from event:', media);
                // Filter out invalid media (where url === id, meaning it's just a placeholder)
                const validMedia = media.filter((m) => {
                    const hasValidUrl = m.url && m.url !== m.id && m.url !== '';
                    if (!hasValidUrl) {
                        console.log('Filtering out invalid media item (url === id or empty):', m);
                    }
                    return hasValidUrl;
                });
                if (validMedia.length > 0) {
                    // Ensure all media items have id field (for backward compatibility)
                    postMedia = validMedia.map((m) => ({
                        id: m.id || m.url || '', // Use id if available, fallback to url or empty string
                        url: m.url,
                        type: m.type || 'image',
                    }));
                }
                else {
                    console.log('No valid media items after filtering');
                    // Don't set postMedia to invalid placeholder - keep it undefined
                    // The post will be updated later when valid media is available
                }
            }
            else if (mediaIds && mediaIds.length > 0) {
                // Don't create placeholder media objects - wait for valid media from PostUpdatedEvent
                // This prevents posts from having invalid media URLs
                console.log('MediaIds present but no media in event - will wait for PostUpdatedEvent with valid media');
                postMedia = undefined;
            }
            else {
                console.log('No media or mediaIds in event');
            }
            console.log('Post media to save:', postMedia);
            const post = post_1.Post.build({
                id,
                userId,
                content,
                media: postMedia,
                visibility: shared_1.Visibility[visibility],
                originalCreation: createdAt
            });
            yield post.save();
            console.log('Post saved with media:', post.media);
            // Enqueue fan-out job
            yield fanout_queue_1.fanoutQueue.add('fanout-job', { postId: id, authorId: userId, visibility });
            // Manual acknowledgment - only after successful save and queue job
            yield this.ack();
        });
    }
}
exports.PostCreatedListener = PostCreatedListener;
class PostUpdatedListener extends shared_1.Listener {
    constructor() {
        super(...arguments);
        this.topic = shared_1.Subjects.PostUpdated;
        this.groupId = queGroupNames_1.GroupIdPostUpdated;
    }
    onMessage(data, msg) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('Post updated event received:', data);
            const { id, content, mediaIds, media, visibility, updatedAt, reactions, commentCount, } = data;
            // Find the post in feed service
            const post = yield post_1.Post.findOne({ _id: id });
            if (!post) {
                console.log(`Post ${id} not found in feed service`);
                yield this.ack();
                return;
            }
            // Use media from event if available, otherwise keep existing media
            // Media from event contains id and url (unsigned) as published by media service
            let postMedia = undefined;
            if (media && media.length > 0) {
                // Filter out invalid media (where url === id, meaning it's just a placeholder)
                const validMedia = media.filter((m) => {
                    const hasValidUrl = m.url && m.url !== m.id && m.url !== '';
                    if (!hasValidUrl) {
                        console.log('Filtering out invalid media item in update (url === id or empty):', m);
                    }
                    return hasValidUrl;
                });
                if (validMedia.length > 0) {
                    // Ensure all media items have id field (for backward compatibility)
                    postMedia = validMedia.map((m) => ({
                        id: m.id || m.url || '', // Use id if available, fallback to url or empty string
                        url: m.url,
                        type: m.type || 'image',
                    }));
                }
                else {
                    console.log('No valid media items in update event - keeping existing media');
                    // Keep existing media if update doesn't have valid media
                    postMedia = post.media;
                }
            }
            else if (mediaIds && mediaIds.length > 0) {
                // If mediaIds are present but no media, keep existing media (don't overwrite with invalid data)
                console.log('MediaIds present but no media in update event - keeping existing media');
                postMedia = post.media;
            }
            else {
                // No mediaIds means media was removed - clear it
                postMedia = undefined;
            }
            // Update post data
            post.content = content;
            post.media = postMedia;
            post.visibility = visibility;
            post.updatedAt = new Date(updatedAt);
            // Update reactionsSummary from event if provided
            if (reactions && Array.isArray(reactions)) {
                post.reactionsSummary = reactions.map((r) => ({
                    type: r.type,
                    count: r.count || 1,
                }));
            }
            // Update commentCount from event if provided
            if (commentCount !== undefined) {
                post.commentsCount = commentCount;
            }
            yield post.save();
            console.log(`Updated post ${id} in feed service, reactionsSummary:`, post.reactionsSummary, `commentsCount:`, post.commentsCount);
            // Manual acknowledgment - only after successful save
            yield this.ack();
        });
    }
}
exports.PostUpdatedListener = PostUpdatedListener;
class PostDeletedListener extends shared_1.Listener {
    constructor() {
        super(...arguments);
        this.topic = shared_1.Subjects.PostDeleted;
        this.groupId = queGroupNames_1.GroupIdPostDeleted;
    }
    onMessage(data, msg) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('Post deleted event received:', data);
            const { id } = data;
            // Find and delete the post from feed service
            const post = yield post_1.Post.findOne({ _id: id });
            if (!post) {
                console.log(`Post ${id} not found in feed service`);
                yield this.ack();
                return;
            }
            yield post_1.Post.deleteOne({ _id: id });
            console.log(`Deleted post ${id} from feed service`);
            // Manual acknowledgment - only after successful deletion
            yield this.ack();
        });
    }
}
exports.PostDeletedListener = PostDeletedListener;
