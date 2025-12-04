"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Comment = exports.commentSchema = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const commentSchema = new mongoose_1.default.Schema({
    postId: { type: String, required: true },
    userId: { type: String, required: true },
    text: { type: String, required: true },
    deleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
    isDeleted: { type: Boolean, default: false, index: true },
    parentCommentId: { type: String, required: false } // for threads/replies
}, {
    timestamps: true,
    versionKey: 'version',
    optimisticConcurrency: true,
    toJSON: {
        transform(doc, ret) {
            ret.id = ret._id;
            delete ret._id;
            delete ret.__v;
        },
    },
});
exports.commentSchema = commentSchema;
commentSchema.statics.build = (attrs) => new Comment(attrs);
const Comment = mongoose_1.default.model('Comment', commentSchema);
exports.Comment = Comment;
