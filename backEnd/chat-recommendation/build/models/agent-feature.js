"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentFeature = exports.AgentProvisioningStatus = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
var AgentProvisioningStatus;
(function (AgentProvisioningStatus) {
    AgentProvisioningStatus["Pending"] = "pending";
    AgentProvisioningStatus["Active"] = "active";
    AgentProvisioningStatus["Failed"] = "failed";
})(AgentProvisioningStatus || (exports.AgentProvisioningStatus = AgentProvisioningStatus = {}));
const agentFeatureSchema = new mongoose_1.default.Schema({
    _id: { type: String, required: true },
    agentId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    displayName: { type: String },
    tags: [{ type: String, index: true }],
    skills: [{ type: String }],
    specialization: { type: String, index: true },
    profession: { type: String },
    popularity: { type: Number, default: 0, index: true },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    embeddings: [{ type: Number }],
    isActive: { type: Boolean, default: true, index: true }, // Deprecated: Use provisioningStatus
    provisioningStatus: {
        type: String,
        enum: Object.values(AgentProvisioningStatus),
        default: AgentProvisioningStatus.Pending,
        index: true,
        required: true,
    },
    isPublic: { type: Boolean, default: true, index: true },
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
// Compound indexes for common queries
agentFeatureSchema.index({ tags: 1, provisioningStatus: 1, isPublic: 1 });
agentFeatureSchema.index({ specialization: 1, provisioningStatus: 1 });
agentFeatureSchema.index({ language: 1, provisioningStatus: 1, isPublic: 1 });
// Keep isActive index for backward compatibility during migration
agentFeatureSchema.index({ tags: 1, isActive: 1, isPublic: 1 });
agentFeatureSchema.statics.build = (attrs) => {
    return new exports.AgentFeature(Object.assign({ _id: attrs.agentId }, attrs));
};
exports.AgentFeature = mongoose_1.default.model('AgentFeature', agentFeatureSchema);
