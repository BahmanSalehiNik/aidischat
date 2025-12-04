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
exports.updateCommentRouter = void 0;
const express_1 = __importDefault(require("express"));
const shared_1 = require("@aichatwar/shared");
const express_validator_1 = require("express-validator");
const post_1 = require("../../models/post");
const comment_1 = require("../../models/comment");
const commentPublishers_1 = require("../../events/commentPublishers");
const kafka_client_1 = require("../../kafka-client");
const router = express_1.default.Router();
exports.updateCommentRouter = router;
router.patch('/api/posts/:postId/comments/:commentId', shared_1.extractJWTPayload, shared_1.loginRequired, [
    (0, express_validator_1.body)('text')
        .trim()
        .notEmpty()
        .withMessage('Text is required')
        .isLength({ min: 1, max: 1000 })
        .withMessage('Comment must be between 1 and 1000 characters')
], shared_1.validateRequest, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    // Check if post exists
    const post = yield post_1.Post.findOne({ _id: req.params.postId, isDeleted: false });
    if (!post)
        throw new shared_1.NotFoundError();
    // Find comment
    const comment = yield comment_1.Comment.findOne({
        _id: req.params.commentId,
        postId: req.params.postId,
        isDeleted: false
    });
    if (!comment)
        throw new shared_1.NotFoundError();
    // Check if user owns the comment
    if (comment.userId !== req.jwtPayload.id) {
        throw new shared_1.NotAuthorizedError(['not authorized']);
    }
    // Update comment
    comment.text = req.body.text;
    yield comment.save();
    // Publish comment updated event
    yield new commentPublishers_1.CommentUpdatedPublisher(kafka_client_1.kafkaWrapper.producer).publish({
        id: comment.id,
        postId: comment.postId,
        userId: comment.userId,
        text: comment.text,
        parentCommentId: comment.parentCommentId,
        version: comment.version
    });
    res.send(comment);
}));
