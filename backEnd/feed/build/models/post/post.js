"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Post = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const mongoose_update_if_current_1 = require("mongoose-update-if-current");
const postSchema = new mongoose_1.default.Schema({
    _id: { type: String },
    userId: { type: String, required: true },
    content: { type: String, required: true },
    media: {
        type: [{
                id: { type: String, required: false },
                url: { type: String, required: false },
                type: { type: String, required: false },
            }],
        default: undefined,
    },
    originalCreation: { type: String, required: true },
    visibility: {
        type: String,
        enum: ['public', 'friends', 'private'],
        default: 'public',
    },
    commentsCount: { type: Number, default: 0 },
    reactionsSummary: [{ type: { type: String }, count: Number }],
}, {
    toJSON: {
        transform(doc, ret) {
            ret.id = ret._id;
            delete ret._id;
        },
    },
    // versionKey: 'version',
    timestamps: true,
});
postSchema.set('versionKey', 'version');
postSchema.plugin(mongoose_update_if_current_1.updateIfCurrentPlugin);
postSchema.statics.build = (attrs) => {
    return new exports.Post(Object.assign({ _id: attrs.id }, attrs));
};
exports.Post = mongoose_1.default.model('Post', postSchema);
