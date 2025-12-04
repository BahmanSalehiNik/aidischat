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
exports.app = void 0;
const express_1 = __importDefault(require("express"));
require("express-async-errors");
const body_parser_1 = require("body-parser");
const cookie_session_1 = __importDefault(require("cookie-session"));
const createPost_1 = require("./routes/post/createPost");
const getPost_1 = require("./routes/post/getPost");
const getPosts_1 = require("./routes/post/getPosts");
const updatePost_1 = require("./routes/post/updatePost");
const addComment_1 = require("./routes/comment/addComment");
const getComments_1 = require("./routes/comment/getComments");
const getCommentById_1 = require("./routes/comment/getCommentById");
const updateComment_1 = require("./routes/comment/updateComment");
const deleteComment_1 = require("./routes/comment/deleteComment");
const addPostReaction_1 = require("./routes/reaction/addPostReaction");
const deleteReaction_1 = require("./routes/reaction/deleteReaction");
const addCommentReaction_1 = require("./routes/reaction/addCommentReaction");
const deleteCommentReaction_1 = require("./routes/reaction/deleteCommentReaction");
const shared_1 = require("@aichatwar/shared");
const cors_1 = __importDefault(require("cors"));
const app = (0, express_1.default)();
exports.app = app;
app.set('trust proxy', true);
app.use((0, body_parser_1.json)());
app.use((0, cookie_session_1.default)({
    signed: false,
    secure: false, //process.env.NODE_ENV !== 'test'
    sameSite: "lax"
}));
app.use((0, cors_1.default)({ origin: ["aichatwar-games.com", "http://aichatwar-games.com", "https://aichatwar-games.com"], credentials: true }));
app.use(shared_1.extractJWTPayload);
app.use(createPost_1.createPostRouter);
app.use(getPost_1.getPostRouter);
app.use(getPosts_1.getPostsRouter);
app.use(updatePost_1.updatePostRouter);
app.use(addComment_1.addCommentRouter);
app.use(getComments_1.getCommentsRouter);
app.use(getCommentById_1.getCommentByIdRouter);
app.use(updateComment_1.updateCommentRouter);
app.use(deleteComment_1.deleteCommentRouter);
app.use(addPostReaction_1.addPostReactionRouter);
app.use(deleteReaction_1.deletePostReactionRouter);
app.use(addCommentReaction_1.addCommentReactionRouter);
app.use(deleteCommentReaction_1.deleteCommentReactionRouter);
app.all('*', () => __awaiter(void 0, void 0, void 0, function* () {
    throw new shared_1.NotFoundError();
}));
app.use(shared_1.errorHandler);
