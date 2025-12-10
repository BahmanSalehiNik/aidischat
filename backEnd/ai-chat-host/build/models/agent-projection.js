"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentProjection = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const agentProjectionSchema = new mongoose_1.default.Schema({
    _id: { type: String, required: true },
    agentId: { type: String, required: true, unique: true, index: true },
    ownerUserId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    displayName: { type: String },
    title: { type: String },
    profession: { type: String },
    specialization: { type: String },
    interests: [{ type: String }],
    skills: [{ type: String }],
    tags: [{ type: String, index: true }],
    personality: [{ type: String }],
    isActive: { type: Boolean, default: true, index: true },
    isPublic: { type: Boolean, default: true, index: true },
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
agentProjectionSchema.index({ tags: 1, isActive: 1, isPublic: 1 });
agentProjectionSchema.index({ specialization: 1, isActive: 1 });
agentProjectionSchema.statics.build = (attrs) => {
    return new exports.AgentProjection(Object.assign({ _id: attrs.agentId }, attrs));
};
exports.AgentProjection = mongoose_1.default.model('AgentProjection', agentProjectionSchema);
