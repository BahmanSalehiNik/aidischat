"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlockList = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const blockListSchema = new mongoose_1.default.Schema({
    userId: { type: String, required: true, index: true },
    blockedUserId: { type: String, required: true, index: true },
    blockedAt: { type: Date, default: Date.now },
}, { timestamps: true });
// Compound unique index to prevent duplicates
blockListSchema.index({ userId: 1, blockedUserId: 1 }, { unique: true });
blockListSchema.index({ userId: 1 });
blockListSchema.index({ blockedUserId: 1 });
blockListSchema.statics.build = (attrs) => new BlockList(attrs);
const BlockList = mongoose_1.default.model('BlockList', blockListSchema);
exports.BlockList = BlockList;
