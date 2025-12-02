"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostStatus = exports.Post = void 0;
// models/post.ts
const mongoose_1 = __importDefault(require("mongoose"));
const shared_1 = require("@aichatwar/shared");
Object.defineProperty(exports, "PostStatus", { enumerable: true, get: function () { return shared_1.PostStatus; } });
const postSchema = new mongoose_1.default.Schema({
    userId: { type: String, required: true },
    content: { type: String, required: true },
    mediaIds: [String],
    media: {
        type: [{
                id: { type: String, required: false },
                url: { type: String, required: false },
                type: { type: String, required: false },
            }],
        default: undefined,
    },
    visibility: { type: String, Visibility: shared_1.Visibility, default: 'public' },
    reactions: [{ userId: String, type: String }],
    status: {
        type: String,
        enum: shared_1.PostStatus,
        default: shared_1.PostStatus.Active
    },
    deletedAt: { type: Date, default: null },
    isDeleted: { type: Boolean, default: false, index: true }
}, { timestamps: true,
    toJSON: {
        transform(doc, ret) {
            ret.id = ret._id;
            delete ret._id;
        },
    }
});
// Index for efficient sorting by createdAt
postSchema.index({ createdAt: -1 });
postSchema.index({ userId: 1, createdAt: -1 }); // Compound index for user posts queries
postSchema.statics.build = (attrs) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = attrs, rest = __rest(attrs, ["id"]);
    return new Post(Object.assign({ _id: id }, rest));
});
const Post = mongoose_1.default.model('Post', postSchema);
exports.Post = Post;
