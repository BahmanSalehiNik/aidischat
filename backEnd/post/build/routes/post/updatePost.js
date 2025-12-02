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
exports.updatePostRouter = void 0;
const express_1 = __importDefault(require("express"));
const express_validator_1 = require("express-validator");
const shared_1 = require("@aichatwar/shared");
const post_1 = require("../../models/post");
const postPublisher_1 = require("../../events/publishers/postPublisher");
const kafka_client_1 = require("../../kafka-client");
const mediaLookup_1 = require("../../utils/mediaLookup");
const router = express_1.default.Router();
exports.updatePostRouter = router;
router.patch('/api/posts/:id', shared_1.loginRequired, shared_1.extractJWTPayload, [
    (0, express_validator_1.body)('content').optional().isString().trim().isLength({ max: 5000 }),
    (0, express_validator_1.body)('visibility')
        .optional()
        .isIn([shared_1.Visibility.Friends, shared_1.Visibility.Private, shared_1.Visibility.Public])
        .withMessage('Invalid visibility'),
], shared_1.validateRequest, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const post = yield post_1.Post.findById(req.params.id);
    if (!post) {
        throw new shared_1.NotFoundError();
    }
    if (post.userId !== req.jwtPayload.id) {
        throw new shared_1.NotAuthorizedError(['']);
    }
    const { content, visibility, mediaIds } = req.body;
    if (content)
        post.content = content;
    if (visibility)
        post.visibility = visibility;
    if (mediaIds)
        post.mediaIds = mediaIds;
    // Get media from cache, document, or retry cache
    const validMedia = yield (0, mediaLookup_1.getPostMedia)(post, {
        checkDocument: false, // Document check is built into the function
        updateDocument: false,
    });
    // Store media in post document if found, or clear if mediaIds is empty
    if (validMedia && validMedia.length > 0) {
        post.media = validMedia;
    }
    else if (mediaIds && (!mediaIds.length || !validMedia || validMedia.length === 0)) {
        // Clear media if mediaIds is empty or no valid media found
        post.media = undefined;
    }
    yield post.save();
    // 🔢 Aggregate reactions for event (type -> count)
    const aggregatedReactions = post.reactions.reduce((acc, reaction) => {
        acc[reaction.type] = (acc[reaction.type] || 0) + 1;
        return acc;
    }, {});
    const reactionsArray = Object.entries(aggregatedReactions).map(([type, count]) => ({
        type,
        count,
    }));
    // 📡 Publish the event
    yield new postPublisher_1.PostUpdatedPublisher(kafka_client_1.kafkaWrapper.producer).publish({
        id: post.id,
        userId: post.userId,
        content: post.content,
        mediaIds: post.mediaIds,
        media: validMedia,
        visibility: post.visibility,
        status: post.status,
        reactions: reactionsArray,
        version: post.version,
        updatedAt: new Date().toISOString(),
        createdAt: post.createdAt.toISOString(),
        commentCount: 0
    });
    res.status(200).send(post);
}));
