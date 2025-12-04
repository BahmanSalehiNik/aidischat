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
exports.getFeedRouter = void 0;
const express_1 = __importDefault(require("express"));
const shared_1 = require("@aichatwar/shared");
const feed_1 = require("../models/feed/feed");
const post_1 = require("../models/post/post");
const profile_1 = require("../models/user/profile");
const user_1 = require("../models/user/user");
const block_list_1 = require("../models/block-list");
const user_status_1 = require("../models/user-status");
const azureStorageGateway_1 = require("../storage/azureStorageGateway");
const trendingService_1 = require("../modules/trending/trendingService");
const router = express_1.default.Router();
exports.getFeedRouter = router;
// Initialize read-only Azure Storage Gateway if credentials are available
let azureGateway = null;
if (process.env.AZURE_STORAGE_ACCOUNT && process.env.AZURE_STORAGE_KEY) {
    azureGateway = new azureStorageGateway_1.ReadOnlyAzureStorageGateway(process.env.AZURE_STORAGE_ACCOUNT, process.env.AZURE_STORAGE_KEY);
}
const sanitizeMediaItems = (media) => {
    if (!media || !Array.isArray(media))
        return [];
    return media.filter((mediaItem) => (mediaItem === null || mediaItem === void 0 ? void 0 : mediaItem.url) && mediaItem.url !== mediaItem.id);
};
function buildSignedMedia(media) {
    return __awaiter(this, void 0, void 0, function* () {
        const validMediaItems = sanitizeMediaItems(media);
        if (!validMediaItems.length) {
            return undefined;
        }
        if (!azureGateway) {
            return validMediaItems;
        }
        return Promise.all(validMediaItems.map((mediaItem) => __awaiter(this, void 0, void 0, function* () {
            const parsed = azureGateway.parseBlobUrl(mediaItem.url);
            if (parsed) {
                try {
                    const signedUrl = yield azureGateway.generateDownloadUrl(parsed.container, parsed.blobName, 900);
                    return Object.assign(Object.assign({}, mediaItem), { url: signedUrl, originalUrl: mediaItem.url });
                }
                catch (error) {
                    console.error('Error generating signed URL for media:', error);
                }
            }
            return mediaItem;
        })));
    });
}
/**
 * Helper function to get recent public posts as trending-like format
 */
function getRecentPublicPostsAsTrending(userId_1, limit_1) {
    return __awaiter(this, arguments, void 0, function* (userId, limit, excludePostIds = new Set()) {
        const blockedUsers = yield block_list_1.BlockList.find({ userId })
            .select('blockedUserId')
            .lean();
        const blockedSet = new Set(blockedUsers.map((b) => b.blockedUserId));
        const nonSuggestibleUsers = yield user_status_1.UserStatus.find({ isSuggestible: false })
            .select('userId')
            .lean();
        const excludeUserIds = [...nonSuggestibleUsers.map((u) => u.userId), ...Array.from(blockedSet)];
        const recentPublicPosts = yield post_1.Post.find({
            visibility: 'public',
            media: { $exists: true, $ne: [], $not: { $size: 0 } },
            _id: { $nin: Array.from(excludePostIds) },
            userId: { $nin: excludeUserIds },
        })
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();
        return recentPublicPosts.map(post => ({
            postId: post._id.toString(),
            authorId: post.userId,
            content: post.content,
            media: post.media,
            createdAt: post.createdAt || new Date(post.originalCreation),
            trendingScore: 0,
        }));
    });
}
/**
 * Helper to build trending items from trending posts
 */
function buildTrendingItems(trending_1, userId_1) {
    return __awaiter(this, arguments, void 0, function* (trending, userId, excludePostIds = new Set()) {
        if (trending.length === 0)
            return [];
        const trendingAuthorIds = Array.from(new Set(trending.map((t) => t.authorId)));
        const [profiles, users] = yield Promise.all([
            profile_1.Profile.find({ userId: { $in: trendingAuthorIds } })
                .select('userId username avatarUrl')
                .lean(),
            user_1.User.find({ _id: { $in: trendingAuthorIds } })
                .select('_id email')
                .lean(),
        ]);
        const profileMap = new Map(profiles.map((p) => [p.userId, p]));
        const userMap = new Map(users.map((u) => {
            const id = typeof u._id === 'string' ? u._id : u._id.toString();
            return [id, u];
        }));
        // Fetch post projections to get reactionsSummary and commentsCount
        const postIds = trending.map(t => t.postId);
        const posts = yield post_1.Post.find({ _id: { $in: postIds } })
            .select('_id reactionsSummary commentsCount')
            .lean();
        const postMap = new Map(posts.map((p) => [p._id, p]));
        // Note: We don't fetch current user's reactions for trending posts (same reason as above)
        const userReactionMap = new Map();
        return Promise.all(trending.map((entry) => __awaiter(this, void 0, void 0, function* () {
            const profile = profileMap.get(entry.authorId);
            const user = userMap.get(entry.authorId);
            let displayName = profile === null || profile === void 0 ? void 0 : profile.username;
            if (!displayName && (user === null || user === void 0 ? void 0 : user.email)) {
                displayName = user.email.split('@')[0];
            }
            if (!displayName) {
                displayName = `User ${entry.authorId.slice(0, 8)}`;
            }
            const mediaWithSignedUrls = yield buildSignedMedia(entry.media);
            // Get reactionsSummary and commentsCount from post projection
            const post = postMap.get(entry.postId);
            // Get current user's reaction
            const userReaction = userReactionMap.get(entry.postId);
            const currentUserReaction = userReaction ? { userId: userReaction.userId, type: userReaction.type } : undefined;
            return {
                feedId: null,
                postId: entry.postId,
                author: {
                    userId: entry.authorId,
                    name: displayName,
                    email: user === null || user === void 0 ? void 0 : user.email,
                    avatarUrl: profile === null || profile === void 0 ? void 0 : profile.avatarUrl,
                },
                content: entry.content,
                media: mediaWithSignedUrls,
                visibility: 'public',
                reactionsSummary: (post === null || post === void 0 ? void 0 : post.reactionsSummary) || [],
                currentUserReaction,
                commentsCount: (post === null || post === void 0 ? void 0 : post.commentsCount) || 0,
                createdAt: entry.createdAt,
                source: 'trending',
                status: feed_1.FeedStatus.Unseen,
            };
        })));
    });
}
/**
 * GET /api/feeds
 * Query Params:
 *  - limit: number (default: 10)
 *  - cursor: feedId or 'trending' (for pagination)
 */
router.get('/api/feeds', shared_1.loginRequired, shared_1.extractJWTPayload, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.jwtPayload.id;
    const limit = parseInt(req.query.limit || '10', 10);
    const cursor = req.query.cursor;
    // Check if cursor indicates we should fetch trending
    const isTrendingCursor = cursor === 'trending' || cursor === null || cursor === 'null';
    // If cursor is 'trending', we're paginating through trending posts
    if (isTrendingCursor) {
        console.log('[Feed] Fetching trending posts (cursor: trending)');
        // Get all feed post IDs to exclude from trending
        const allFeedPostIds = yield feed_1.Feed.find({ userId })
            .select('postId')
            .lean();
        const excludePostIds = new Set(allFeedPostIds.map(f => f.postId));
        // Fetch trending posts
        let trending = yield trendingService_1.trendingService.getTopPosts(limit * 2, userId);
        if (trending.length < limit) {
            const recentAsTrending = yield getRecentPublicPostsAsTrending(userId, limit * 2, excludePostIds);
            const allTrending = [...trending, ...recentAsTrending];
            const uniqueTrendingMap = new Map();
            allTrending.forEach(post => {
                if (!uniqueTrendingMap.has(post.postId)) {
                    uniqueTrendingMap.set(post.postId, post);
                }
            });
            trending = Array.from(uniqueTrendingMap.values())
                .sort((a, b) => {
                if (b.trendingScore !== a.trendingScore) {
                    return b.trendingScore - a.trendingScore;
                }
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            })
                .slice(0, limit * 2);
        }
        // Filter out posts already in feed
        const uniqueTrending = trending.filter(t => !excludePostIds.has(t.postId));
        const trendingItems = yield buildTrendingItems(uniqueTrending.slice(0, limit), userId);
        // For trending pagination, use a simple offset-based approach
        // Return 'trending' as next cursor to continue fetching trending
        const nextCursor = uniqueTrending.length > limit ? 'trending' : null;
        return res.send({
            items: trendingItems,
            nextCursor,
            source: 'trending'
        });
    }
    // Fetch personalized feeds with pagination
    const feedQuery = { userId, status: { $in: [feed_1.FeedStatus.Unseen, feed_1.FeedStatus.Seen] } };
    if (cursor && cursor !== 'trending') {
        const cursorFeed = yield feed_1.Feed.findById(cursor);
        if (cursorFeed) {
            feedQuery.createdAt = { $lt: cursorFeed.createdAt };
        }
    }
    // Fetch feed entries
    const feeds = yield feed_1.Feed.find(feedQuery)
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();
    // If no feeds, return trending
    if (!feeds.length) {
        console.log('[Feed] No personalized feeds, returning trending');
        const allFeedPostIds = yield feed_1.Feed.find({ userId })
            .select('postId')
            .lean();
        const excludePostIds = new Set(allFeedPostIds.map(f => f.postId));
        let trending = yield trendingService_1.trendingService.getTopPosts(limit, userId);
        if (trending.length === 0) {
            trending = yield getRecentPublicPostsAsTrending(userId, limit, excludePostIds);
        }
        const uniqueTrending = trending.filter(t => !excludePostIds.has(t.postId));
        const trendingItems = yield buildTrendingItems(uniqueTrending.slice(0, limit), userId);
        return res.send({
            items: trendingItems,
            nextCursor: uniqueTrending.length > limit ? 'trending' : null,
            source: 'trending'
        });
    }
    // Extract postIds and fetch posts
    const feedPostIds = feeds.map(f => f.postId);
    const posts = yield post_1.Post.find({ _id: { $in: feedPostIds } })
        .sort({ createdAt: -1 })
        .lean()
        .exec();
    // Fetch profile and user info
    const authorIds = Array.from(new Set(posts.map(p => p.userId)));
    const [profiles, users] = yield Promise.all([
        profile_1.Profile.find({ userId: { $in: authorIds } })
            .select('userId username avatarUrl')
            .lean(),
        user_1.User.find({ _id: { $in: authorIds } })
            .select('_id email')
            .lean(),
    ]);
    const profileMap = new Map(profiles.map((p) => [p.userId, p]));
    const userMap = new Map(users.map((u) => {
        const id = typeof u._id === 'string' ? u._id : u._id.toString();
        return [id, u];
    }));
    const postMap = new Map(posts.map(p => [p._id, p]));
    const feedMap = new Map(feeds.map(f => [f.postId, f]));
    // Note: We don't fetch current user's reactions here because they're not stored in feed database
    // The feed service maintains reactionsSummary in its Post projection, but not individual user reactions
    // For currentUserReaction, we'd need to either:
    // 1. Store it in the feed database (add userId to reactionsSummary), OR
    // 2. Query post service (which we don't want), OR
    // 3. Have post service include it in PostUpdated event
    // For now, we'll leave currentUserReaction undefined and let the frontend handle it
    const userReactionMap = new Map();
    // Build feed items with status, sorted by priority
    const feedItems = yield Promise.all(feeds.map((feed) => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b, _c;
        const post = postMap.get(feed.postId);
        if (!post)
            return null;
        const postUserId = (_a = post.userId) === null || _a === void 0 ? void 0 : _a.toString();
        const profile = profileMap.get(postUserId);
        const user = userMap.get(postUserId);
        let displayName = profile === null || profile === void 0 ? void 0 : profile.username;
        if (!displayName && (user === null || user === void 0 ? void 0 : user.email)) {
            displayName = user.email.split('@')[0];
        }
        if (!displayName) {
            if (postUserId === userId) {
                displayName = 'You';
            }
            else if (postUserId) {
                displayName = `User ${postUserId.slice(0, 8)}`;
            }
            else {
                displayName = 'User';
            }
        }
        const mediaWithSignedUrls = yield buildSignedMedia(post.media);
        // Get current user's reaction
        const postIdStr = ((_b = post._id) === null || _b === void 0 ? void 0 : _b.toString()) || ((_c = post.id) === null || _c === void 0 ? void 0 : _c.toString()) || String(post._id || post.id);
        const userReaction = userReactionMap.get(postIdStr);
        const currentUserReaction = userReaction ? { userId: userReaction.userId, type: userReaction.type } : undefined;
        return {
            feedId: feed._id,
            postId: post._id,
            author: {
                userId: post.userId,
                name: displayName,
                email: user === null || user === void 0 ? void 0 : user.email,
                avatarUrl: profile === null || profile === void 0 ? void 0 : profile.avatarUrl,
            },
            content: post.content,
            media: mediaWithSignedUrls,
            visibility: post.visibility,
            reactionsSummary: post.reactionsSummary || [],
            currentUserReaction,
            commentsCount: post.commentsCount || 0,
            createdAt: post.createdAt || post.originalCreation,
            status: feed.status,
            source: 'feed',
        };
    })));
    const validFeedItems = feedItems.filter(Boolean);
    // Sort by priority: unseen > seen, then by recency
    validFeedItems.sort((a, b) => {
        if (!a || !b)
            return 0;
        const aUnseen = a.status === feed_1.FeedStatus.Unseen ? 0 : 1;
        const bUnseen = b.status === feed_1.FeedStatus.Unseen ? 0 : 1;
        if (aUnseen !== bUnseen) {
            return aUnseen - bUnseen;
        }
        const aTime = new Date(a.createdAt).getTime();
        const bTime = new Date(b.createdAt).getTime();
        return bTime - aTime;
    });
    // Check if we have more personalized feeds
    const hasMoreFeeds = feeds.length === limit;
    const nextFeedCursor = hasMoreFeeds && feeds.length > 0
        ? feeds[feeds.length - 1]._id.toString()
        : null;
    // ALWAYS append trending feeds after personalized feeds
    // Get all feed post IDs to exclude from trending
    const allFeedPostIds = yield feed_1.Feed.find({ userId })
        .select('postId')
        .lean();
    const excludePostIds = new Set(allFeedPostIds.map(f => f.postId));
    validFeedItems.forEach(item => {
        if (item === null || item === void 0 ? void 0 : item.postId) {
            excludePostIds.add(item.postId.toString());
        }
    });
    // Fetch trending posts
    let trending = yield trendingService_1.trendingService.getTopPosts(limit, userId);
    if (trending.length < limit) {
        const recentAsTrending = yield getRecentPublicPostsAsTrending(userId, limit, excludePostIds);
        const allTrending = [...trending, ...recentAsTrending];
        const uniqueTrendingMap = new Map();
        allTrending.forEach(post => {
            if (!uniqueTrendingMap.has(post.postId)) {
                uniqueTrendingMap.set(post.postId, post);
            }
        });
        trending = Array.from(uniqueTrendingMap.values())
            .sort((a, b) => {
            if (b.trendingScore !== a.trendingScore) {
                return b.trendingScore - a.trendingScore;
            }
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        })
            .slice(0, limit);
    }
    // Filter out duplicates and build trending items
    const uniqueTrending = trending.filter(t => !excludePostIds.has(t.postId));
    const trendingItems = yield buildTrendingItems(uniqueTrending.slice(0, limit), userId);
    // Merge: personalized feeds first, then trending
    // Sort trending items: unseen > seen, then by recency
    trendingItems.sort((a, b) => {
        if (!a || !b)
            return 0;
        const aUnseen = a.status === feed_1.FeedStatus.Unseen ? 0 : 1;
        const bUnseen = b.status === feed_1.FeedStatus.Unseen ? 0 : 1;
        if (aUnseen !== bUnseen) {
            return aUnseen - bUnseen;
        }
        const aTime = new Date(a.createdAt).getTime();
        const bTime = new Date(b.createdAt).getTime();
        return bTime - aTime;
    });
    const allItems = [...validFeedItems, ...trendingItems];
    // Apply limit to total items
    const finalItems = allItems.slice(0, limit);
    // Determine next cursor:
    // - If we have more personalized feeds, use feed cursor
    // - If we've exhausted personalized feeds but have trending, use 'trending'
    // - Otherwise, null
    let nextCursor = null;
    if (hasMoreFeeds) {
        nextCursor = nextFeedCursor;
    }
    else if (uniqueTrending.length > finalItems.filter(item => item.source === 'trending').length) {
        nextCursor = 'trending';
    }
    const response = {
        items: finalItems,
        nextCursor
    };
    if (trendingItems.length > 0) {
        response.hasTrending = true;
        response.trendingCount = finalItems.filter(item => item.source === 'trending').length;
    }
    console.log(`[Feed] Returning ${finalItems.length} items (${validFeedItems.length} feed, ${finalItems.filter(item => item.source === 'trending').length} trending), nextCursor: ${nextCursor}`);
    res.send(response);
}));
