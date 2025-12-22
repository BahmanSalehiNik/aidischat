"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Avatar = exports.AvatarModelFormat = exports.AvatarModelType = exports.AvatarStatus = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
var AvatarStatus;
(function (AvatarStatus) {
    AvatarStatus["Pending"] = "pending";
    AvatarStatus["Generating"] = "generating";
    AvatarStatus["Ready"] = "ready";
    AvatarStatus["Failed"] = "failed";
})(AvatarStatus || (exports.AvatarStatus = AvatarStatus = {}));
var AvatarModelType;
(function (AvatarModelType) {
    AvatarModelType["ThreeD"] = "3d";
    AvatarModelType["Anime"] = "anime";
    AvatarModelType["Hybrid"] = "hybrid";
    AvatarModelType["Live2D"] = "live2d";
})(AvatarModelType || (exports.AvatarModelType = AvatarModelType = {}));
var AvatarModelFormat;
(function (AvatarModelFormat) {
    AvatarModelFormat["GLB"] = "glb";
    AvatarModelFormat["GLTF"] = "gltf";
    AvatarModelFormat["VRM"] = "vrm";
    AvatarModelFormat["FBX"] = "fbx";
    AvatarModelFormat["Live2D"] = "live2d";
})(AvatarModelFormat || (exports.AvatarModelFormat = AvatarModelFormat = {}));
const avatarSchema = new mongoose_1.default.Schema({
    _id: { type: String, required: true },
    agentId: { type: String, required: true, index: true, unique: true },
    ownerUserId: { type: String, required: true, index: true },
    modelType: {
        type: String,
        enum: Object.values(AvatarModelType),
        default: AvatarModelType.ThreeD,
    },
    format: {
        type: String,
        enum: Object.values(AvatarModelFormat),
        default: AvatarModelFormat.GLB,
    },
    version: { type: Number, default: 1 },
    modelUrl: { type: String },
    textureUrls: [{ type: String }],
    animationUrls: [{ type: String }],
    metadataUrl: { type: String },
    polygonCount: { type: Number },
    textureResolution: { type: Number },
    boneCount: { type: Number },
    animationCount: { type: Number },
    status: {
        type: String,
        enum: Object.values(AvatarStatus),
        default: AvatarStatus.Pending,
        index: true,
    },
    generationStartedAt: { type: Date },
    generationCompletedAt: { type: Date },
    generationError: { type: String },
    provider: { type: String },
    providerModelId: { type: String },
    characterDescription: { type: mongoose_1.default.Schema.Types.Mixed },
    rendering: {
        scale: { type: Number, default: 1.0 },
        position: {
            x: { type: Number, default: 0 },
            y: { type: Number, default: 0 },
            z: { type: Number, default: 0 },
        },
        rotation: {
            x: { type: Number, default: 0 },
            y: { type: Number, default: 0 },
            z: { type: Number, default: 0 },
        },
    },
    animations: {
        idle: { type: String },
        talking: { type: String },
        gestures: [{ type: String }],
    },
    lipSync: {
        enabled: { type: Boolean, default: true },
        method: { type: String, enum: ['viseme', 'bone', 'blendshape'], default: 'viseme' },
        visemeMap: { type: mongoose_1.default.Schema.Types.Mixed },
    },
}, {
    timestamps: true,
    toJSON: {
        transform(_doc, ret) {
            ret.id = ret._id;
            delete ret._id;
            delete ret.__v;
        },
    },
});
avatarSchema.statics.build = function (attrs) {
    return new this(Object.assign({ _id: `avatar_${attrs.agentId}` }, attrs));
};
avatarSchema.statics.findByAgentId = function (agentId) {
    return this.findOne({ agentId });
};
exports.Avatar = mongoose_1.default.model('Avatar', avatarSchema);
