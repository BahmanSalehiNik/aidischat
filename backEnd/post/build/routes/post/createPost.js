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
exports.createPostRouter = void 0;
// routes/create-post.ts
const express_1 = __importDefault(require("express"));
const shared_1 = require("@aichatwar/shared");
const postPublisher_1 = require("../../events/publishers/postPublisher");
const post_1 = require("../../models/post");
const kafka_client_1 = require("../../kafka-client");
const express_validator_1 = require("express-validator");
const mediaLookup_1 = require("../../utils/mediaLookup");
const router = express_1.default.Router();
exports.createPostRouter = router;
router.post('/api/post', shared_1.extractJWTPayload, shared_1.loginRequired, [
    (0, express_validator_1.body)('content').optional().isString().isLength({ min: 1 }).withMessage('Text must be valid'),
    (0, express_validator_1.body)('mediaIds').optional().isArray().withMessage('MediaIds must be an array of strings'),
    (0, express_validator_1.body)('visibility').optional().isIn([shared_1.Visibility.Friends, shared_1.Visibility.Private, shared_1.Visibility.Public]),
], shared_1.validateRequest, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id, content, mediaIds, visibility, version } = req.body;
    const post = yield post_1.Post.build({
        id: id,
        userId: req.jwtPayload.id,
        content,
        mediaIds,
        visibility,
        version
    });
    // Get media from cache and store in document
    let validMedia = yield (0, mediaLookup_1.getPostMedia)(post, {
        checkDocument: false, // Will check after save
        updateDocument: false,
    });
    // Store media in post document if found
    if (validMedia && validMedia.length > 0) {
        post.media = validMedia;
    }
    yield post.save();
    // If we have mediaIds but no valid media, check document after save and retry cache
    if (post.mediaIds && post.mediaIds.length > 0 && (!validMedia || validMedia.length === 0)) {
        validMedia = yield (0, mediaLookup_1.getPostMedia)(post, {
            checkDocument: true, // Check document after save
            updateDocument: true, // Update document if found on retry
        });
        // If we found media on retry, update the post document and save again
        if (validMedia && validMedia.length > 0) {
            const savedPost = yield post_1.Post.findById(post.id);
            if (savedPost) {
                savedPost.media = validMedia;
                yield savedPost.save();
                // Update the local post object for response
                post.media = validMedia;
            }
        }
    }
    console.log('Post media to publish:', validMedia);
    console.log('Post mediaIds:', post.mediaIds);
    yield new postPublisher_1.PostCreatedPublisher(kafka_client_1.kafkaWrapper.producer).publish({
        id: post.id,
        userId: post.userId,
        content: post.content,
        mediaIds: post.mediaIds,
        media: validMedia,
        visibility: post.visibility,
        createdAt: post.createdAt.toISOString(),
        version: post.version
    });
    // Include media in response so client has it immediately
    const postResponse = post.toJSON();
    if (validMedia) {
        postResponse.media = validMedia;
    }
    res.status(201).send(postResponse);
}));
