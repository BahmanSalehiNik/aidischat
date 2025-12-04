"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserStatus = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const userStatusSchema = new mongoose_1.default.Schema({
    userId: { type: String, required: true, unique: true, index: true },
    status: {
        type: String,
        enum: ['active', 'deleted', 'suspended', 'banned', 'deactive'],
        default: 'active',
    },
    isDeleted: { type: Boolean, default: false, index: true },
    isSuggestible: { type: Boolean, default: true, index: true },
    deletedAt: { type: Date, default: undefined },
    updatedAt: { type: Date, default: Date.now },
}, { timestamps: true });
userStatusSchema.index({ isSuggestible: 1 });
userStatusSchema.statics.build = (attrs) => new UserStatus(attrs);
const UserStatus = mongoose_1.default.model('UserStatus', userStatusSchema);
exports.UserStatus = UserStatus;
