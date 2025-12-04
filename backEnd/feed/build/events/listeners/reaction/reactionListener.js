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
exports.ReactionDeletedListener = exports.ReactionCreatedListener = void 0;
const shared_1 = require("@aichatwar/shared");
const post_1 = require("../../../models/post/post");
const GroupIdReactionCreated = 'feed-reaction-created';
const GroupIdReactionDeleted = 'feed-reaction-deleted';
const normalizeReactionsSummary = (summary) => {
    const map = new Map();
    summary
        .filter((entry) => entry && entry.type)
        .forEach((entry) => {
        const key = entry.type;
        const count = typeof entry.count === 'number' ? entry.count : 0;
        map.set(key, (map.get(key) || 0) + count);
    });
    return Array.from(map.entries())
        .filter(([, count]) => count > 0)
        .map(([type, count]) => ({
        type,
        count,
    }));
};
class ReactionCreatedListener extends shared_1.Listener {
    constructor() {
        super(...arguments);
        this.topic = shared_1.Subjects.ReactionCreated;
        this.groupId = GroupIdReactionCreated;
    }
    onMessage(data, msg) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('Reaction created event received:', data);
            const { postId, type } = data;
            // Only process post reactions (not comment reactions)
            if (!postId || data.commentId) {
                yield this.ack();
                return;
            }
            // Find the post in feed service
            const post = yield post_1.Post.findOne({ _id: postId });
            if (!post) {
                console.log(`Post ${postId} not found in feed service`);
                yield this.ack();
                return;
            }
            // Update reactionsSummary incrementally
            // Initialize if it doesn't exist
            if (!post.reactionsSummary || !Array.isArray(post.reactionsSummary)) {
                post.reactionsSummary = [];
            }
            // Find existing reaction type or create new
            const existingReaction = post.reactionsSummary.find((r) => r.type === type);
            if (existingReaction) {
                // Increment count
                existingReaction.count = (existingReaction.count || 0) + 1;
            }
            else {
                // Add new reaction type
                post.reactionsSummary.push({ type, count: 1 });
            }
            post.reactionsSummary = normalizeReactionsSummary(post.reactionsSummary);
            yield post.save();
            console.log(`Updated reactionsSummary for post ${postId}:`, post.reactionsSummary);
            yield this.ack();
        });
    }
}
exports.ReactionCreatedListener = ReactionCreatedListener;
class ReactionDeletedListener extends shared_1.Listener {
    constructor() {
        super(...arguments);
        this.topic = shared_1.Subjects.ReactionDeleted;
        this.groupId = GroupIdReactionDeleted;
    }
    onMessage(data, msg) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('Reaction deleted event received:', data);
            const { postId, type } = data;
            // Only process post reactions (not comment reactions)
            if (!postId || data.commentId) {
                yield this.ack();
                return;
            }
            // Find the post in feed service
            const post = yield post_1.Post.findOne({ _id: postId });
            if (!post) {
                console.log(`Post ${postId} not found in feed service`);
                yield this.ack();
                return;
            }
            // Update reactionsSummary incrementally
            if (!post.reactionsSummary || !Array.isArray(post.reactionsSummary)) {
                post.reactionsSummary = [];
            }
            // Decrement the reaction type if we have it
            if (type) {
                const existingReaction = post.reactionsSummary.find((r) => r.type === type);
                if (existingReaction) {
                    existingReaction.count = Math.max((existingReaction.count || 1) - 1, 0);
                    // Remove if count reaches 0
                    if (existingReaction.count === 0) {
                        post.reactionsSummary = post.reactionsSummary.filter((r) => r.type !== type);
                    }
                }
            }
            else {
                // If type is not provided, we can't decrement accurately
                // This will be handled by PostUpdated event which includes full reactionsSummary
                console.log(`Reaction deleted for post ${postId} but type not provided, will rely on PostUpdated event`);
            }
            post.reactionsSummary = normalizeReactionsSummary(post.reactionsSummary);
            yield post.save();
            console.log(`Updated reactionsSummary for post ${postId} after deletion:`, post.reactionsSummary);
            yield this.ack();
        });
    }
}
exports.ReactionDeletedListener = ReactionDeletedListener;
