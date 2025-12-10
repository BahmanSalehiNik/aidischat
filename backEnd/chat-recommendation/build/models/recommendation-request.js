"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecommendationRequest = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const recommendationRequestSchema = new mongoose_1.default.Schema({
    _id: { type: String, required: true },
    requestId: { type: String, required: true, unique: true, index: true },
    contextType: { type: String, enum: ['chat', 'feed', 'explore', 'profile'], required: true, index: true },
    userId: { type: String, required: true, index: true },
    roomId: { type: String, index: true },
    status: { type: String, enum: ['pending', 'processing', 'completed', 'failed'], default: 'pending', index: true },
    requestedAt: { type: Date, required: true, index: true },
    completedAt: { type: Date },
    recommendations: [{ type: mongoose_1.default.Schema.Types.Mixed }],
    error: { type: String },
}, {
    timestamps: true,
    toJSON: {
        transform(_doc, ret) {
            ret.id = ret._id;
            delete ret._id;
        }
    }
});
recommendationRequestSchema.index({ userId: 1, requestedAt: -1 });
recommendationRequestSchema.index({ roomId: 1, requestedAt: -1 });
recommendationRequestSchema.statics.build = (attrs) => {
    return new exports.RecommendationRequest(Object.assign({ _id: attrs.requestId }, attrs));
};
exports.RecommendationRequest = mongoose_1.default.model('RecommendationRequest', recommendationRequestSchema);
