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
exports.getCommentsRouter = void 0;
const express_1 = __importDefault(require("express"));
const shared_1 = require("@aichatwar/shared");
const post_1 = require("../../models/post");
const comment_1 = require("../../models/comment");
const profile_1 = require("../../models/user/profile");
const user_1 = require("../../models/user/user");
const reaction_1 = require("../../models/reaction");
const router = express_1.default.Router();
exports.getCommentsRouter = router;
router.get('/api/posts/:postId/comments', shared_1.extractJWTPayload, shared_1.loginRequired, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const currentUserId = req.jwtPayload.id;
    // Check if post exists
    const post = yield post_1.Post.findOne({ _id: req.params.postId, isDeleted: false });
    if (!post) {
        throw new shared_1.NotFoundError();
    }
    // Get query parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const parentCommentId = req.query.parentCommentId;
    // Build query
    const query = {
        postId: req.params.postId,
        isDeleted: false
    };
    // If parentCommentId is provided, get replies to that comment
    // If not provided, get top-level comments (no parent)
    if (parentCommentId) {
        query.parentCommentId = parentCommentId;
    }
    else {
        query.parentCommentId = { $exists: false };
    }
    // Get comments with pagination
    const comments = yield comment_1.Comment.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();
    // Get total count for pagination
    const totalCount = yield comment_1.Comment.countDocuments(query);
    // Fetch profile and user information for all comment authors
    const userIds = Array.from(new Set(comments.map((c) => c.userId)));
    const [profiles, users] = yield Promise.all([
        profile_1.Profile.find({ userId: { $in: userIds } })
            .select('userId username avatarUrl')
            .lean(),
        user_1.User.find({ _id: { $in: userIds } })
            .select('_id email')
            .lean(),
    ]);
    const profileMap = new Map(profiles.map((p) => [p.userId, p]));
    const userMap = new Map(users.map((u) => {
        const id = typeof u._id === 'string' ? u._id : u._id.toString();
        return [id, u];
    }));
    // Fetch reactions for all comments
    const commentIds = comments.map((c) => { var _a; return ((_a = c._id) === null || _a === void 0 ? void 0 : _a.toString()) || c.id; });
    const allReactions = yield reaction_1.Reaction.find({
        commentId: { $in: commentIds }
    }).lean();
    // Group reactions by commentId
    const reactionsByComment = new Map();
    allReactions.forEach((r) => {
        var _a;
        const commentId = (_a = r.commentId) === null || _a === void 0 ? void 0 : _a.toString();
        if (commentId) {
            if (!reactionsByComment.has(commentId)) {
                reactionsByComment.set(commentId, []);
            }
            reactionsByComment.get(commentId).push(r);
        }
    });
    // Enrich comments with author information and reactions
    const enrichedComments = comments.map((comment) => {
        var _a, _b;
        const commentUserId = (_a = comment.userId) === null || _a === void 0 ? void 0 : _a.toString();
        const profile = profileMap.get(commentUserId);
        const user = userMap.get(commentUserId);
        // Determine display name
        let displayName;
        if (profile === null || profile === void 0 ? void 0 : profile.username) {
            displayName = profile.username;
        }
        else if (user === null || user === void 0 ? void 0 : user.email) {
            displayName = user.email.split('@')[0];
        }
        if (!displayName) {
            if (commentUserId === currentUserId) {
                displayName = 'You';
            }
            else if (commentUserId) {
                displayName = `User ${commentUserId.slice(0, 8)}`;
            }
            else {
                displayName = 'User';
            }
        }
        // Get reactions for this comment
        const commentId = ((_b = comment._id) === null || _b === void 0 ? void 0 : _b.toString()) || comment.id;
        const commentReactions = reactionsByComment.get(commentId) || [];
        // Aggregate reactions by type
        const reactionMap = new Map();
        commentReactions.forEach((r) => {
            const type = r.type || 'like';
            reactionMap.set(type, (reactionMap.get(type) || 0) + 1);
        });
        const reactionsSummary = Array.from(reactionMap.entries()).map(([type, count]) => ({
            type,
            count,
        }));
        // Get current user's reaction
        const userReaction = commentReactions.find((r) => r.userId === currentUserId);
        const currentUserReaction = userReaction ? { userId: userReaction.userId, type: userReaction.type } : undefined;
        return Object.assign(Object.assign({}, comment), { author: {
                userId: comment.userId,
                name: displayName,
                email: user === null || user === void 0 ? void 0 : user.email,
                avatarUrl: profile === null || profile === void 0 ? void 0 : profile.avatarUrl,
            }, reactions: reactionsSummary, currentUserReaction });
    });
    res.send({
        comments: enrichedComments,
        pagination: {
            page,
            limit,
            totalCount,
            totalPages: Math.ceil(totalCount / limit)
        }
    });
}));
