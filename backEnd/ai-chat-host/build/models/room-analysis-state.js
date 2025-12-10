"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoomAnalysisState = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const roomAnalysisStateSchema = new mongoose_1.default.Schema({
    _id: { type: String, required: true },
    roomId: { type: String, required: true, unique: true, index: true },
    lastAnalysisAt: { type: Date, default: null },
    lastInvitationAt: { type: Date, default: null },
    totalAnalyses: { type: Number, default: 0 },
    totalInvitations: { type: Number, default: 0 },
    cooldownUntil: { type: Date, default: null },
    activeWindowSize: { type: Number, default: 0 },
}, {
    timestamps: true,
    toJSON: {
        transform(_doc, ret) {
            ret.id = ret._id;
            delete ret._id;
        }
    }
});
roomAnalysisStateSchema.statics.build = (attrs) => {
    return new exports.RoomAnalysisState(Object.assign({ _id: attrs.roomId }, attrs));
};
exports.RoomAnalysisState = mongoose_1.default.model('RoomAnalysisState', roomAnalysisStateSchema);
