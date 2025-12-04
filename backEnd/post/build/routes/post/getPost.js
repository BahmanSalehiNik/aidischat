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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPostRouter = void 0;
// routes/get-post.ts
const express_1 = __importDefault(require("express"));
const post_1 = require("../../models/post");
const reaction_1 = require("../../models/reaction");
const visibilityCheck_1 = require("../../utils/visibilityCheck");
const shared_1 = require("@aichatwar/shared");
const profile_1 = require("../../models/user/profile");
const user_1 = require("../../models/user/user");
const router = express_1.default.Router();
exports.getPostRouter = router;
router.get('/api/posts/:id', shared_1.extractJWTPayload, shared_1.loginRequired, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const currentUserId = req.jwtPayload.id;
    const post = yield post_1.Post.findById(req.params.id);
    if (!post || post.status != post_1.PostStatus.Active)
        return res.status(404).send({ message: 'Not found' });
    const allowed = yield (0, visibilityCheck_1.canView)(currentUserId, post.userId, post.visibility);
    if (!allowed)
        return res.status(403).send({ message: 'Forbidden' });
    // Fetch reactions from Reaction collection
    const reactions = yield reaction_1.Reaction.find({ postId: post.id, commentId: { $exists: false } }).lean();
    // Aggregate reactions by type
    const reactionMap = new Map();
    reactions.forEach((r) => {
        const type = r.type || 'like';
        reactionMap.set(type, (reactionMap.get(type) || 0) + 1);
    });
    const reactionsSummary = Array.from(reactionMap.entries()).map(([type, count]) => ({
        type,
        count,
    }));
    // Get current user's reaction
    const userReaction = reactions.find((r) => r.userId === currentUserId);
    const currentUserReaction = userReaction ? { userId: userReaction.userId, type: userReaction.type } : undefined;
    // Fetch author information
    const profile = yield profile_1.Profile.findOne({ userId: post.userId }).lean();
    const user = yield user_1.User.findById(post.userId).select('email').lean();
    let displayName;
    if (profile === null || profile === void 0 ? void 0 : profile.username) {
        displayName = profile.username;
    }
    else if (user === null || user === void 0 ? void 0 : user.email) {
        displayName = user.email.split('@')[0];
    }
    if (!displayName) {
        if (post.userId === currentUserId) {
            displayName = 'You';
        }
        else if (post.userId) {
            displayName = `User ${post.userId.slice(0, 8)}`;
        }
        else {
            displayName = 'User';
        }
    }
    // Combine reactions from Post document (legacy) and Reaction collection
    // Prefer Reaction collection data
    const allReactions = reactions.map((r) => ({
        userId: r.userId,
        type: r.type,
    }));
    const response = Object.assign(Object.assign({}, post.toJSON()), { reactions: allReactions, // Include all reactions with userId for frontend
        reactionsSummary, // Include summary for easy display
        currentUserReaction, author: {
            userId: post.userId,
            name: displayName,
            email: user === null || user === void 0 ? void 0 : user.email,
            avatarUrl: profile === null || profile === void 0 ? void 0 : profile.avatarUrl,
        } });
    res.send(response);
}));
