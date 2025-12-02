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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.addPostReactionRouter = void 0;
const express_1 = __importDefault(require("express"));
const shared_1 = require("@aichatwar/shared");
const express_validator_1 = require("express-validator");
const shared_2 = require("@aichatwar/shared");
const reaction_1 = require("../../models/reaction");
const post_1 = require("../../models/post");
const reactionPublishers_1 = require("../../events/reactionPublishers");
const kafka_client_1 = require("../../kafka-client");
const router = express_1.default.Router();
exports.addPostReactionRouter = router;
router.post('/api/posts/:postId/reactions', shared_1.extractJWTPayload, shared_1.loginRequired, [
    (0, express_validator_1.body)('type')
        .isIn(['like', 'love', 'haha', 'sad', 'angry'])
        .withMessage('Reaction type must be one of: like, love, haha, sad, angry'),
], shared_2.validateRequest, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { type } = req.body;
    const userId = req.jwtPayload.id;
    const postId = req.params.postId;
    // Check if post exists
    const post = yield post_1.Post.findOne({ _id: postId, isDeleted: false });
    if (!post || post.status !== post_1.PostStatus.Active) {
        throw new shared_1.NotFoundError();
    }
    // Check if user already has a reaction on this post
    const existing = yield reaction_1.Reaction.findOne({ userId, postId, commentId: { $exists: false } });
    if (existing) {
        const previousType = existing.type;
        const nextType = type;
        // If changing reaction type, publish deleted for old type first
        if (previousType !== nextType) {
            yield new reactionPublishers_1.ReactionDeletedPublisher(kafka_client_1.kafkaWrapper.producer).publish({
                id: existing.id,
                userId: existing.userId,
                postId: existing.postId,
                commentId: existing.commentId,
                type: previousType,
            });
        }
        // Update existing reaction
        existing.type = nextType;
        yield existing.save();
        // Publish reaction created/updated event only when the type actually changed
        if (previousType !== nextType) {
            yield new reactionPublishers_1.ReactionCreatedPublisher(kafka_client_1.kafkaWrapper.producer).publish({
                id: existing.id,
                userId: existing.userId,
                postId: existing.postId,
                commentId: existing.commentId,
                type: nextType,
                version: 0,
            });
        }
        return res.status(200).send(existing);
    }
    // Create new reaction
    const reaction = reaction_1.Reaction.build({ userId, postId, type });
    yield reaction.save();
    // Publish reaction created event
    yield new reactionPublishers_1.ReactionCreatedPublisher(kafka_client_1.kafkaWrapper.producer).publish({
        id: reaction.id,
        userId: reaction.userId,
        postId: reaction.postId,
        commentId: reaction.commentId,
        type: reaction.type,
        version: 0,
    });
    res.status(201).send(reaction);
}));
