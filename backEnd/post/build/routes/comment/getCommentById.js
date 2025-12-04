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
exports.getCommentByIdRouter = void 0;
const express_1 = __importDefault(require("express"));
const shared_1 = require("@aichatwar/shared");
const post_1 = require("../../models/post");
const comment_1 = require("../../models/comment");
const router = express_1.default.Router();
exports.getCommentByIdRouter = router;
router.get('/api/posts/:postId/comments/:commentId', shared_1.extractJWTPayload, shared_1.loginRequired, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
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
    res.send(comment);
}));
