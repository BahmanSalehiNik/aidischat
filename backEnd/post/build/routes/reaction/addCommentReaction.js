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
exports.addCommentReactionRouter = void 0;
const express_1 = __importDefault(require("express"));
const shared_1 = require("@aichatwar/shared");
const express_validator_1 = require("express-validator");
const shared_2 = require("@aichatwar/shared");
const reaction_1 = require("../../models/reaction");
const comment_1 = require("../../models/comment");
const reactionPublishers_1 = require("../../events/reactionPublishers");
const kafka_client_1 = require("../../kafka-client");
const router = express_1.default.Router();
exports.addCommentReactionRouter = router;
router.post('/api/comments/:commentId/reactions', shared_1.extractJWTPayload, shared_1.loginRequired, [
    (0, express_validator_1.body)('type')
        .isIn(['like', 'love', 'haha', 'sad', 'angry'])
        .withMessage('Reaction type must be one of: like, love, haha, sad, angry'),
], shared_2.validateRequest, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { type } = req.body;
    const userId = req.jwtPayload.id;
    const commentId = req.params.commentId;
    // Check if comment exists
    const comment = yield comment_1.Comment.findOne({ _id: commentId, isDeleted: false });
    if (!comment) {
        throw new shared_1.NotFoundError();
    }
    // Check if user already has a reaction on this comment
    const existing = yield reaction_1.Reaction.findOne({ userId, commentId });
    if (existing) {
        // Update existing reaction
        existing.type = type;
        yield existing.save();
        // Publish reaction updated event
        yield new reactionPublishers_1.ReactionCreatedPublisher(kafka_client_1.kafkaWrapper.producer).publish({
            id: existing.id,
            userId: existing.userId,
            postId: existing.postId,
            commentId: existing.commentId,
            type: existing.type,
            version: 0,
        });
        return res.status(200).send(existing);
    }
    // Create new reaction
    const reaction = reaction_1.Reaction.build({ userId, commentId, postId: comment.postId, type });
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
