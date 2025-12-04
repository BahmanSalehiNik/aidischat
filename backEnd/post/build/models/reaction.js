"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Reaction = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const reactionSchema = new mongoose_1.default.Schema({
    userId: { type: String, required: true },
    postId: String,
    commentId: String,
    type: {
        type: String,
        enum: ['like', 'love', 'haha', 'sad', 'angry'],
        required: true,
    },
}, { timestamps: true });
reactionSchema.statics.build = (attrs) => new exports.Reaction(attrs);
exports.Reaction = mongoose_1.default.model('Reaction', reactionSchema);
