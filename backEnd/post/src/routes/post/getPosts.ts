// routes/get-posts.ts
import express, { Request, Response } from 'express';
import { Post, PostStatus } from '../../models/post';
import { Reaction } from '../../models/reaction';
import { Profile } from '../../models/user/profile';
import { User } from '../../models/user/user';
import { extractJWTPayload, loginRequired } from '@aichatwar/shared';
import { mediaCache } from '../../utils/mediaCache';
import { ReadOnlyAzureStorageGateway } from '../../storage/azureStorageGateway';
import { Friendship, FriendshipStatus } from '../../models/friendship/freindship';

// Initialize read-only Azure Storage Gateway if credentials are available
let azureGateway: ReadOnlyAzureStorageGateway | null = null;
if (process.env.AZURE_STORAGE_ACCOUNT && process.env.AZURE_STORAGE_KEY) {
  azureGateway = new ReadOnlyAzureStorageGateway(
    process.env.AZURE_STORAGE_ACCOUNT,
    process.env.AZURE_STORAGE_KEY
  );
}

const router = express.Router();

/**
 * GET /api/posts
 * Query Params:
 *  - userId: optional, filter posts by userId
 *  - limit: optional, number of posts to return (default: 20)
 *  - offset: optional, pagination offset (default: 0)
 */
router.get(
  '/api/posts', 
  extractJWTPayload, 
  loginRequired,
  async (req: Request, res: Response) => {
    const currentUserId = req.jwtPayload!.id;
    const requestedUserId = req.query.userId as string | undefined;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    // Build query
    const query: any = {
      isDeleted: false,
      status: PostStatus.Active,
    };

    // If userId is provided, filter by that userId
    // Otherwise, return posts visible to the current user
    if (requestedUserId) {
      query.userId = requestedUserId;
    }

    // Find posts
    const posts = await Post.find(query)
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .lean();

    // Visibility filtering (profile page relies on this)
    let filteredPosts = posts;
    if (requestedUserId) {
      // Profile page mode: all posts are owned by requestedUserId (due to query.userId)
      if (requestedUserId !== currentUserId) {
        const friendship = await Friendship.findOne({
          status: FriendshipStatus.Accepted,
          $or: [
            { requester: requestedUserId, recipient: currentUserId },
            { requester: currentUserId, recipient: requestedUserId },
          ],
        }).lean();
        const isFriend = Boolean(friendship);

        filteredPosts = posts.filter((post: any) => {
          if (post.visibility === 'public') return true;
          if (post.visibility === 'private') return false;
          // friends
          return isFriend;
        });
      }
    } else {
      // Global mode: safest default without N+1 friendship checks
      // - always include own posts
      // - include public posts from others
      filteredPosts = posts.filter((post: any) => post.userId === currentUserId || post.visibility === 'public');
    }

    // Fetch profile information for all unique user IDs
    const userIds = Array.from(new Set(filteredPosts.map((p: any) => p.userId)));
    const profiles = await Profile.find({ userId: { $in: userIds } })
      .select('userId username avatarUrl')
      .lean();

    // Fetch user information for fallback (email)
    const users = await User.find({ _id: { $in: userIds } })
      .select('_id email')
      .lean();

    // Create maps for quick lookup
    const profileMap = new Map(profiles.map((p: any) => [p.userId, p]));
    // User _id might be stored as string or ObjectId, so we need to handle both
    const userMap = new Map(users.map((u: any) => {
      const userId = typeof u._id === 'string' ? u._id : u._id.toString();
      return [userId, u];
    }));

    // Fetch all reactions for all posts in one query
    const postIds = filteredPosts.map((p: any) => p._id?.toString() || p.id);
    const allReactions = await Reaction.find({ 
      postId: { $in: postIds },
      commentId: { $exists: false }
    }).lean();

    // Group reactions by postId
    const reactionsByPost = new Map<string, any[]>();
    allReactions.forEach((r: any) => {
      const postId = r.postId?.toString();
      if (postId) {
        if (!reactionsByPost.has(postId)) {
          reactionsByPost.set(postId, []);
        }
        reactionsByPost.get(postId)!.push(r);
      }
    });

    // Enrich posts with author information and reactions
    const enrichedPosts = await Promise.all(filteredPosts.map(async (post: any) => {
      const postId = post._id?.toString() || post.id;
      const postReactions = reactionsByPost.get(postId) || [];
      
      // Aggregate reactions by type
      const reactionMap = new Map<string, number>();
      postReactions.forEach((r: any) => {
        const type = r.type || 'like';
        reactionMap.set(type, (reactionMap.get(type) || 0) + 1);
      });

      const reactionsSummary = Array.from(reactionMap.entries()).map(([type, count]) => ({
        type,
        count,
      }));

      // Get current user's reaction
      const userReaction = postReactions.find((r: any) => r.userId === currentUserId);
      const currentUserReaction = userReaction ? { userId: userReaction.userId, type: userReaction.type } : undefined;
      const postUserId = post.userId?.toString();
      const profile = profileMap.get(postUserId);
      const user = userMap.get(postUserId);
      
      // Determine the display name: prefer username, fallback to email prefix
      let displayName: string | undefined;
      if (profile?.username) {
        displayName = profile.username;
      } else if (user?.email) {
        // Extract name from email (e.g., "john@example.com" -> "john")
        displayName = user.email.split('@')[0];
      }
      
      if (!displayName) {
        if (postUserId === currentUserId) {
          displayName = 'You';
        } else if (postUserId) {
          displayName = `User ${postUserId.slice(0, 8)}`;
        } else {
          displayName = 'User';
        }
      }
      // If still no name, we'll let the frontend handle the fallback

      // Get media from post document (stored when post was created/updated)
      // Fallback to cache if not in document (for backward compatibility)
      let media: Array<{ id: string; url: string; type: string }> | undefined = undefined;
      
      if (post.media && Array.isArray(post.media) && post.media.length > 0) {
        // Use media stored in post document (preferred)
        media = post.media;
        console.log(`Using media from post document for post ${post.id}:`, post.media.length, 'items');
      }
      
      // Always check cache as well - if document has media but cache has more recent data, use cache
      // Or if document doesn't have media, use cache
      if (post.mediaIds && post.mediaIds.length > 0) {
        const mediaIdStrings = post.mediaIds.map((id: any) => String(id));
        const cachedMedia = mediaCache.getMany(mediaIdStrings);
        
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
            Post.findByIdAndUpdate(post.id, { media: validCachedMedia }).catch(err => {
              console.error(`Failed to update post ${post.id} with cached media:`, err);
            });
          }
        } else if (!media && cachedMedia.length > 0) {
          console.log(`Warning: Post ${post.id} has mediaIds but no valid media in cache or document`);
        }
      }

      // Generate signed URLs for media if Azure gateway is available (same as feed service)
      let mediaWithSignedUrls = media;
      if (azureGateway && media && Array.isArray(media) && media.length > 0) {
        console.log('Processing media for post:', post.id, 'Media count:', media.length);
        
        // Filter out invalid media items (where url === id, meaning it's just a mediaId, not a real URL)
        const validMediaItems = media.filter((mediaItem: any) => {
          if (!mediaItem?.url) return false;
          // If url is the same as id, it's likely just a mediaId placeholder, not a real URL
          if (mediaItem.url === mediaItem.id) {
            console.log('Skipping invalid media item (url === id):', mediaItem);
            return false;
          }
          return true;
        });
        
        if (validMediaItems.length > 0) {
          mediaWithSignedUrls = await Promise.all(
            validMediaItems.map(async (mediaItem: any) => {
              console.log('Processing media URL:', mediaItem.url);
              
              // Try to parse blob URL to extract container and blob name
              const parsed = azureGateway!.parseBlobUrl(mediaItem.url);
              if (parsed) {
                console.log('Parsed blob URL:', parsed);
                try {
                  // Generate signed download URL (15 minutes expiry)
                  const signedUrl = await azureGateway!.generateDownloadUrl(
                    parsed.container,
                    parsed.blobName,
                    900
                  );
                  console.log('Generated signed URL for media');
                  return {
                    ...mediaItem,
                    url: signedUrl,
                    originalUrl: mediaItem.url, // Keep original for reference
                  };
                } catch (error) {
                  console.error('Error generating signed URL for media:', error, 'URL:', mediaItem.url);
                  // Return original URL if signing fails
                  return mediaItem;
                }
              } else {
                console.log('Could not parse blob URL:', mediaItem.url);
              }
              
              // If not a blob URL, return as-is (might be a public URL or different format)
              return mediaItem;
            })
          );
        } else {
          // No valid media items after filtering
          mediaWithSignedUrls = undefined;
          console.log('No valid media items after filtering for post:', post.id);
        }
      } else {
        console.log('Media processing skipped:', {
          hasGateway: !!azureGateway,
          hasMedia: !!media,
          isArray: Array.isArray(media),
          mediaLength: media?.length || 0
        });
      }

      return {
        ...post,
        media: mediaWithSignedUrls,
        reactions: postReactions.map((r: any) => ({ userId: r.userId, type: r.type })), // Include all reactions with userId
        reactionsSummary, // Include summary for easy display
        currentUserReaction, // Include current user's reaction
        commentsCount: post.commentsCount ?? 0,
        author: {
          userId: post.userId,
          name: displayName,
          email: user?.email,
          avatarUrl: profile?.avatarUrl,
        },
      };
    }));

    // Note: Posts are already sorted by createdAt: -1 in the database query
    // The order is preserved through filtering and mapping, so no need to re-sort

    res.send(enrichedPosts);
  }
);

export { router as getPostsRouter };

