"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserFeature = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const userFeatureSchema = new mongoose_1.default.Schema({
    _id: { type: String, required: true },
    userId: { type: String, required: true, unique: true, index: true },
    interests: [{ type: String, index: true }],
    preferredAgents: [{ type: String }],
    interactionHistory: [{
            agentId: { type: String, required: true },
            interactionCount: { type: Number, default: 0 },
            lastInteractionAt: { type: Date, default: Date.now },
            sentiment: { type: String, enum: ['positive', 'neutral', 'negative'] },
        }],
    embeddings: [{ type: Number }],
    preferences: {
        domains: [{ type: String }],
        topics: [{ type: String }],
    },
    language: { type: String, index: true },
    lastUpdatedAt: { type: Date, default: Date.now },
}, {
    timestamps: true,
    toJSON: {
        transform(_doc, ret) {
            ret.id = ret._id;
            delete ret._id;
        }
    }
});
userFeatureSchema.statics.build = (attrs) => {
    return new exports.UserFeature(Object.assign({ _id: attrs.userId }, attrs));
};
exports.UserFeature = mongoose_1.default.model('UserFeature', userFeatureSchema);
