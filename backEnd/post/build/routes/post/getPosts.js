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
exports.getPostsRouter = void 0;
// routes/get-posts.ts
const express_1 = __importDefault(require("express"));
const post_1 = require("../../models/post");
const reaction_1 = require("../../models/reaction");
const profile_1 = require("../../models/user/profile");
const user_1 = require("../../models/user/user");
const shared_1 = require("@aichatwar/shared");
const mediaCache_1 = require("../../utils/mediaCache");
const azureStorageGateway_1 = require("../../storage/azureStorageGateway");
// Initialize read-only Azure Storage Gateway if credentials are available
let azureGateway = null;
if (process.env.AZURE_STORAGE_ACCOUNT && process.env.AZURE_STORAGE_KEY) {
    azureGateway = new azureStorageGateway_1.ReadOnlyAzureStorageGateway(process.env.AZURE_STORAGE_ACCOUNT, process.env.AZURE_STORAGE_KEY);
}
const router = express_1.default.Router();
exports.getPostsRouter = router;
/**
 * GET /api/posts
 * Query Params:
 *  - userId: optional, filter posts by userId
 *  - limit: optional, number of posts to return (default: 20)
 *  - offset: optional, pagination offset (default: 0)
 */
router.get('/api/posts', shared_1.extractJWTPayload, shared_1.loginRequired, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const currentUserId = req.jwtPayload.id;
    const requestedUserId = req.query.userId;
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    // Build query
    const query = {
        isDeleted: false,
        status: post_1.PostStatus.Active,
    };
    // If userId is provided, filter by that userId
    // Otherwise, return posts visible to the current user
    if (requestedUserId) {
        query.userId = requestedUserId;
    }
    // Find posts
    const posts = yield post_1.Post.find(query)
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .lean();
    // If requesting own posts, return all of them
    let filteredPosts = posts;
    if (requestedUserId !== currentUserId) {
        // Filter posts by visibility for the current user
        // For own posts, always return them
        // For other users' posts, check visibility
        filteredPosts = posts.filter(post => {
            // Always show own posts
            if (post.userId === currentUserId) {
                return true;
            }
            // For other users' posts, check visibility
            if (post.visibility === 'public') {
                return true;
            }
            if (post.visibility === 'private') {
                return false; // Private posts are only visible to the author
            }
            // For 'friends' visibility, we'd need to check friendship status
            // For now, return true (can be enhanced later with friendship service)
            return true;
        });
    }
    // Fetch profile information for all unique user IDs
    const userIds = Array.from(new Set(filteredPosts.map((p) => p.userId)));
    const profiles = yield profile_1.Profile.find({ userId: { $in: userIds } })
        .select('userId username avatarUrl')
        .lean();
    // Fetch user information for fallback (email)
    const users = yield user_1.User.find({ _id: { $in: userIds } })
        .select('_id email')
        .lean();
    // Create maps for quick lookup
    const profileMap = new Map(profiles.map((p) => [p.userId, p]));
    // User _id might be stored as string or ObjectId, so we need to handle both
    const userMap = new Map(users.map((u) => {
        const userId = typeof u._id === 'string' ? u._id : u._id.toString();
        return [userId, u];
    }));
    // Fetch all reactions for all posts in one query
    const postIds = filteredPosts.map((p) => { var _a; return ((_a = p._id) === null || _a === void 0 ? void 0 : _a.toString()) || p.id; });
    const allReactions = yield reaction_1.Reaction.find({
        postId: { $in: postIds },
        commentId: { $exists: false }
    }).lean();
    // Group reactions by postId
    const reactionsByPost = new Map();
    allReactions.forEach((r) => {
        var _a;
        const postId = (_a = r.postId) === null || _a === void 0 ? void 0 : _a.toString();
        if (postId) {
            if (!reactionsByPost.has(postId)) {
                reactionsByPost.set(postId, []);
            }
            reactionsByPost.get(postId).push(r);
        }
    });
    // Enrich posts with author information and reactions
    const enrichedPosts = yield Promise.all(filteredPosts.map((post) => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b, _c;
        const postId = ((_a = post._id) === null || _a === void 0 ? void 0 : _a.toString()) || post.id;
        const postReactions = reactionsByPost.get(postId) || [];
        // Aggregate reactions by type
        const reactionMap = new Map();
        postReactions.forEach((r) => {
            const type = r.type || 'like';
            reactionMap.set(type, (reactionMap.get(type) || 0) + 1);
        });
        const reactionsSummary = Array.from(reactionMap.entries()).map(([type, count]) => ({
            type,
            count,
        }));
        // Get current user's reaction
        const userReaction = postReactions.find((r) => r.userId === currentUserId);
        const currentUserReaction = userReaction ? { userId: userReaction.userId, type: userReaction.type } : undefined;
        const postUserId = (_b = post.userId) === null || _b === void 0 ? void 0 : _b.toString();
        const profile = profileMap.get(postUserId);
        const user = userMap.get(postUserId);
        // Determine the display name: prefer username, fallback to email prefix
        let displayName;
        if (profile === null || profile === void 0 ? void 0 : profile.username) {
            displayName = profile.username;
        }
        else if (user === null || user === void 0 ? void 0 : user.email) {
            // Extract name from email (e.g., "john@example.com" -> "john")
            displayName = user.email.split('@')[0];
        }
        if (!displayName) {
            if (postUserId === currentUserId) {
                displayName = 'You';
            }
            else if (postUserId) {
                displayName = `User ${postUserId.slice(0, 8)}`;
            }
            else {
                displayName = 'User';
            }
        }
        // If still no name, we'll let the frontend handle the fallback
        // Get media from post document (stored when post was created/updated)
        // Fallback to cache if not in document (for backward compatibility)
        let media = undefined;
        if (post.media && Array.isArray(post.media) && post.media.length > 0) {
            // Use media stored in post document (preferred)
            media = post.media;
            console.log(`Using media from post document for post ${post.id}:`, post.media.length, 'items');
        }
        // Always check cache as well - if document has media but cache has more recent data, use cache
        // Or if document doesn't have media, use cache
        if (post.mediaIds && post.mediaIds.length > 0) {
            const mediaIdStrings = post.mediaIds.map((id) => String(id));
            const cachedMedia = mediaCache_1.mediaCache.getMany(mediaIdStrings);
            // Filter out fallback media (where url === id, meaning not in cache)
            const validCachedMedia = cachedMedia.filter(m => m.url !== m.id);
            if (validCachedMedia.length > 0) {
                // If we have valid cached media, use it (cache is more up-to-date)
                // Or if document doesn't have media, use cache
                if (!media || media.length === 0 || validCachedMedia.length > media.length) {
                    media = validCachedMedia;
                    console.log(`Using media from cache for post ${post.id}:`, validCachedMedia.length, 'items');
                    // Optionally update document with cache data for future queries
                    // (async, don't wait)
                    post_1.Post.findByIdAndUpdate(post.id, { media: validCachedMedia }).catch(err => {
                        console.error(`Failed to update post ${post.id} with cached media:`, err);
                    });
                }
            }
            else if (!media && cachedMedia.length > 0) {
                console.log(`Warning: Post ${post.id} has mediaIds but no valid media in cache or document`);
            }
        }
        // Generate signed URLs for media if Azure gateway is available (same as feed service)
        let mediaWithSignedUrls = media;
        if (azureGateway && media && Array.isArray(media) && media.length > 0) {
            console.log('Processing media for post:', post.id, 'Media count:', media.length);
            // Filter out invalid media items (where url === id, meaning it's just a mediaId, not a real URL)
            const validMediaItems = media.filter((mediaItem) => {
                if (!(mediaItem === null || mediaItem === void 0 ? void 0 : mediaItem.url))
                    return false;
                // If url is the same as id, it's likely just a mediaId placeholder, not a real URL
                if (mediaItem.url === mediaItem.id) {
                    console.log('Skipping invalid media item (url === id):', mediaItem);
                    return false;
                }
                return true;
            });
            if (validMediaItems.length > 0) {
                mediaWithSignedUrls = yield Promise.all(validMediaItems.map((mediaItem) => __awaiter(void 0, void 0, void 0, function* () {
                    console.log('Processing media URL:', mediaItem.url);
                    // Try to parse blob URL to extract container and blob name
                    const parsed = azureGateway.parseBlobUrl(mediaItem.url);
                    if (parsed) {
                        console.log('Parsed blob URL:', parsed);
                        try {
                            // Generate signed download URL (15 minutes expiry)
                            const signedUrl = yield azureGateway.generateDownloadUrl(parsed.container, parsed.blobName, 900);
                            console.log('Generated signed URL for media');
                            return Object.assign(Object.assign({}, mediaItem), { url: signedUrl, originalUrl: mediaItem.url });
                        }
                        catch (error) {
                            console.error('Error generating signed URL for media:', error, 'URL:', mediaItem.url);
                            // Return original URL if signing fails
                            return mediaItem;
                        }
                    }
                    else {
                        console.log('Could not parse blob URL:', mediaItem.url);
                    }
                    // If not a blob URL, return as-is (might be a public URL or different format)
                    return mediaItem;
                })));
            }
            else {
                // No valid media items after filtering
                mediaWithSignedUrls = undefined;
                console.log('No valid media items after filtering for post:', post.id);
            }
        }
        else {
            console.log('Media processing skipped:', {
                hasGateway: !!azureGateway,
                hasMedia: !!media,
                isArray: Array.isArray(media),
                mediaLength: (media === null || media === void 0 ? void 0 : media.length) || 0
            });
        }
        return Object.assign(Object.assign({}, post), { media: mediaWithSignedUrls, reactions: postReactions.map((r) => ({ userId: r.userId, type: r.type })), // Include all reactions with userId
            reactionsSummary, // Include summary for easy display
            currentUserReaction, commentsCount: (_c = post.commentsCount) !== null && _c !== void 0 ? _c : 0, author: {
                userId: post.userId,
                name: displayName,
                email: user === null || user === void 0 ? void 0 : user.email,
                avatarUrl: profile === null || profile === void 0 ? void 0 : profile.avatarUrl,
            } });
    })));
    // Note: Posts are already sorted by createdAt: -1 in the database query
    // The order is preserved through filtering and mapping, so no need to re-sort
    res.send(enrichedPosts);
}));
