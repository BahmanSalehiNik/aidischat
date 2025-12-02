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
exports.deletePostRouter = void 0;
const express_1 = __importDefault(require("express"));
const shared_1 = require("@aichatwar/shared");
const post_1 = require("../../models/post");
const postPublisher_1 = require("../../events/publishers/postPublisher");
const kafka_client_1 = require("../../kafka-client");
const router = express_1.default.Router();
exports.deletePostRouter = router;
router.delete('/api/posts/:id', shared_1.extractJWTPayload, shared_1.loginRequired, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const post = yield post_1.Post.findById(req.params.id);
    if (!post) {
        return res.status(404).send({ error: 'Post not found' });
    }
    if (post.userId !== req.jwtPayload.id) {
        return res.status(403).send({ error: 'Not authorized' });
    }
    post.status = post_1.PostStatus.Deleted;
    yield post.save();
    yield new postPublisher_1.PostDeletedPublisher(kafka_client_1.kafkaWrapper.producer).publish({
        id: post.id,
        userId: post.userId,
        version: post.version
    });
    res.status(204).send();
}));
