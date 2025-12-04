"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Activity = exports.ActivityVerb = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
var ActivityVerb;
(function (ActivityVerb) {
    ActivityVerb["PostCreated"] = "post_created";
    ActivityVerb["CommentAdded"] = "comment_added";
    ActivityVerb["ReactionAdded"] = "reaction_added";
    ActivityVerb["ReactionRemoved"] = "reaction_removed";
    ActivityVerb["PostDeleted"] = "post_deleted";
    ActivityVerb["Followed"] = "followed";
})(ActivityVerb || (exports.ActivityVerb = ActivityVerb = {}));
const activitySchema = new mongoose_1.default.Schema({
    actorId: { type: String, required: true, index: true },
    objectId: { type: String, required: true },
    verb: { type: String, enum: Object.values(ActivityVerb), required: true },
    targetUserId: { type: String },
    metadata: { type: Object },
}, {
    timestamps: true,
    toJSON: {
        transform(_, ret) {
            ret.id = ret._id;
            delete ret._id;
        },
    },
});
activitySchema.index({ actorId: 1, createdAt: -1 });
activitySchema.index({ verb: 1, createdAt: -1 });
activitySchema.statics.build = (attrs) => new exports.Activity(attrs);
exports.Activity = mongoose_1.default.model('Activity', activitySchema);
