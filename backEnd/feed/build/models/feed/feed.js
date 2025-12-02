"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Feed = exports.FeedStatus = exports.FeedReason = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
var FeedReason;
(function (FeedReason) {
    FeedReason["Friend"] = "friend";
    FeedReason["Follow"] = "follow";
    FeedReason["Recommendation"] = "recommendation";
})(FeedReason || (exports.FeedReason = FeedReason = {}));
var FeedStatus;
(function (FeedStatus) {
    FeedStatus["Unseen"] = "unseen";
    FeedStatus["Seen"] = "seen";
    FeedStatus["Hidden"] = "hidden";
    FeedStatus["Removed"] = "removed";
})(FeedStatus || (exports.FeedStatus = FeedStatus = {}));
const feedSchema = new mongoose_1.default.Schema({
    userId: { type: String, required: true, index: true },
    postId: { type: String, required: true, index: true },
    sourceUserId: { type: String, required: true },
    originalCreationTime: { type: String, required: true },
    reason: {
        type: String,
        enum: Object.values(FeedReason),
        required: true,
    },
    status: {
        type: String,
        enum: Object.values(FeedStatus),
        default: FeedStatus.Unseen,
    },
}, {
    timestamps: true,
    toJSON: {
        transform(_, ret) {
            ret.id = ret._id;
            delete ret._id;
        },
    },
});
// Feed query optimization
feedSchema.index({ userId: 1, createdAt: -1 });
feedSchema.index({ postId: 1, userId: 1 });
feedSchema.statics.build = (attrs) => new exports.Feed(attrs);
exports.Feed = mongoose_1.default.model('Feed', feedSchema);
