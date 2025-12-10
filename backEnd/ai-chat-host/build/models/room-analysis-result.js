"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoomAnalysisResult = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const roomAnalysisResultSchema = new mongoose_1.default.Schema({
    roomId: { type: String, required: true, index: true },
    analyzedAt: { type: Date, required: true, index: true },
    messageWindowSize: { type: Number, required: true },
    topics: [{ type: String }],
    sentiment: {
        overall: { type: String, enum: ['positive', 'neutral', 'negative'], required: true },
        score: { type: Number, required: true, min: -1, max: 1 },
    },
    context: {
        intent: { type: String, required: true },
        domain: { type: String, required: true },
        keywords: [{ type: String }],
    },
    matchedAgentIds: [{ type: String }],
    invitedAgentIds: [{ type: String }],
    invitationReason: { type: String, required: true },
    confidence: { type: Number, default: 0.5, min: 0, max: 1 },
}, {
    timestamps: true,
    toJSON: {
        transform(_doc, ret) {
            ret.id = ret._id;
            delete ret._id;
        }
    }
});
roomAnalysisResultSchema.index({ roomId: 1, analyzedAt: -1 });
roomAnalysisResultSchema.index({ analyzedAt: -1 });
roomAnalysisResultSchema.statics.build = (attrs) => {
    return new exports.RoomAnalysisResult(attrs);
};
exports.RoomAnalysisResult = mongoose_1.default.model('RoomAnalysisResult', roomAnalysisResultSchema);
