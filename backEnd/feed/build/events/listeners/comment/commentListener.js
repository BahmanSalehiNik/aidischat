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
exports.CommentDeletedListener = exports.CommentCreatedListener = void 0;
const shared_1 = require("@aichatwar/shared");
const post_1 = require("../../../models/post/post");
const queGroupNames_1 = require("../../queGroupNames");
class CommentCreatedListener extends shared_1.Listener {
    constructor() {
        super(...arguments);
        this.topic = shared_1.Subjects.CommentCreated;
        this.groupId = queGroupNames_1.GroupIdCommentCreated;
    }
    onMessage(data, msg) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('Comment created event received:', data);
            const { postId } = data;
            // Find the post in feed service
            const post = yield post_1.Post.findOne({ _id: postId });
            if (!post) {
                console.log(`Post ${postId} not found in feed service`);
                yield this.ack();
                return;
            }
            // Increment comment count
            post.commentsCount = (post.commentsCount || 0) + 1;
            yield post.save();
            console.log(`Updated comment count for post ${postId}: ${post.commentsCount}`);
            // Manual acknowledgment - only after successful save
            yield this.ack();
        });
    }
}
exports.CommentCreatedListener = CommentCreatedListener;
class CommentDeletedListener extends shared_1.Listener {
    constructor() {
        super(...arguments);
        this.topic = shared_1.Subjects.CommentDeleted;
        this.groupId = queGroupNames_1.GroupIdCommentDeleted;
    }
    onMessage(data, msg) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('Comment deleted event received:', data);
            const { postId } = data;
            // Find the post in feed service
            const post = yield post_1.Post.findOne({ _id: postId });
            if (!post) {
                console.log(`Post ${postId} not found in feed service`);
                yield this.ack();
                return;
            }
            // Decrement comment count (ensure it doesn't go below 0)
            post.commentsCount = Math.max((post.commentsCount || 0) - 1, 0);
            yield post.save();
            console.log(`Updated comment count for post ${postId}: ${post.commentsCount}`);
            // Manual acknowledgment - only after successful save
            yield this.ack();
        });
    }
}
exports.CommentDeletedListener = CommentDeletedListener;
