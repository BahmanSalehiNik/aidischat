"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrendingPost = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const trendingPostSchema = new mongoose_1.default.Schema({
    postId: { type: String, required: true, unique: true },
    authorId: { type: String, required: true },
    content: { type: String, required: true },
    media: [
        {
            id: { type: String },
            url: { type: String },
            type: { type: String },
        },
    ],
    trendingScore: { type: Number, required: true },
    createdAt: { type: Date, required: true },
}, { timestamps: true });
trendingPostSchema.index({ trendingScore: -1, createdAt: -1 });
trendingPostSchema.statics.build = (attrs) => new exports.TrendingPost(attrs);
exports.TrendingPost = mongoose_1.default.model('TrendingPost', trendingPostSchema);
