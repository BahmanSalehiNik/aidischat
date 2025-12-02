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
Object.defineProperty(exports, "__esModule", { value: true });
exports.trendingService = void 0;
const post_1 = require("../../models/post/post");
const trendingPost_1 = require("../../models/trending/trendingPost");
const user_status_1 = require("../../models/user-status");
const block_list_1 = require("../../models/block-list");
function computeRecencyBoost(date) {
    const hours = (Date.now() - date.getTime()) / (1000 * 60 * 60);
    return Math.max(0, 10 - hours);
}
function computeReactionCount(post) {
    if (!post.reactionsSummary)
        return 0;
    return post.reactionsSummary.reduce((sum, reaction) => sum + ((reaction === null || reaction === void 0 ? void 0 : reaction.count) || 0), 0);
}
function computeTrendingScore(post) {
    const likes = computeReactionCount(post);
    const comments = post.commentsCount || 0;
    const recency = computeRecencyBoost(post.createdAt || new Date());
    return likes * 2 + comments * 3 + recency;
}
function refreshTrendingProjection() {
    return __awaiter(this, arguments, void 0, function* (limit = 100) {
        // Get excluded user IDs (deleted/blocked/restricted)
        const nonSuggestibleUsers = yield user_status_1.UserStatus.find({ isSuggestible: false })
            .select('userId')
            .lean();
        const excludeUserIds = nonSuggestibleUsers.map((u) => u.userId);
        const posts = yield post_1.Post.find({
            visibility: 'public',
            userId: { $nin: excludeUserIds },
        })
            .sort({ createdAt: -1 })
            .limit(500)
            .lean();
        console.log(`[Trending] Found ${posts.length} public posts to evaluate`);
        const scored = posts
            .map((post) => ({
            postId: post._id.toString(),
            authorId: post.userId,
            content: post.content,
            media: post.media,
            createdAt: post.createdAt || new Date(post.originalCreation),
            trendingScore: computeTrendingScore(post),
        }))
            .filter((post) => post.media && post.media.length > 0)
            .sort((a, b) => b.trendingScore - a.trendingScore)
            .slice(0, limit);
        console.log(`[Trending] After filtering for media, ${scored.length} posts remain`);
        if (!scored.length) {
            console.log('[Trending] No posts with media found, skipping trending update');
            return;
        }
        const bulk = scored.map((p) => ({
            updateOne: {
                filter: { postId: p.postId },
                update: { $set: p },
                upsert: true,
            },
        }));
        yield trendingPost_1.TrendingPost.bulkWrite(bulk);
        console.log(`[Trending] Updated ${scored.length} trending posts`);
    });
}
function getTopPosts(limit, viewerUserId) {
    return __awaiter(this, void 0, void 0, function* () {
        let query = {};
        // If viewer is provided, filter by their block list
        if (viewerUserId) {
            const blockedUsers = yield block_list_1.BlockList.find({ userId: viewerUserId })
                .select('blockedUserId')
                .lean();
            const blockedSet = new Set(blockedUsers.map((b) => b.blockedUserId));
            if (blockedSet.size > 0) {
                // Fetch extra posts to account for filtering
                const posts = yield trendingPost_1.TrendingPost.find()
                    .sort({ trendingScore: -1 })
                    .limit(limit * 2)
                    .lean();
                // Filter out posts from blocked users
                return posts.filter((p) => !blockedSet.has(p.authorId)).slice(0, limit);
            }
        }
        // No blocking or no viewer - return top posts
        return trendingPost_1.TrendingPost.find(query).sort({ trendingScore: -1 }).limit(limit).lean();
    });
}
exports.trendingService = {
    refreshNow: refreshTrendingProjection,
    getTopPosts,
};
