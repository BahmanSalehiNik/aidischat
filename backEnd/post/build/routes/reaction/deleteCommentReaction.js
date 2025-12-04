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
exports.deleteCommentReactionRouter = void 0;
const express_1 = __importDefault(require("express"));
const shared_1 = require("@aichatwar/shared");
const reaction_1 = require("../../models/reaction");
const reactionPublishers_1 = require("../../events/reactionPublishers");
const kafka_client_1 = require("../../kafka-client");
const router = express_1.default.Router();
exports.deleteCommentReactionRouter = router;
router.delete('/api/comments/:commentId/reactions', shared_1.extractJWTPayload, shared_1.loginRequired, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.jwtPayload.id;
    const commentId = req.params.commentId;
    const reaction = yield reaction_1.Reaction.findOne({ userId, commentId });
    if (!reaction) {
        throw new shared_1.NotFoundError();
    }
    if (reaction.userId !== userId) {
        throw new shared_1.NotAuthorizedError(['not authorized']);
    }
    // Publish reaction deleted event before deleting
    yield new reactionPublishers_1.ReactionDeletedPublisher(kafka_client_1.kafkaWrapper.producer).publish({
        id: reaction.id,
        userId: reaction.userId,
        postId: reaction.postId,
        commentId: reaction.commentId,
    });
    yield reaction.deleteOne();
    res.status(204).send();
}));
