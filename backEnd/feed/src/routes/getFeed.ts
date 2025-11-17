import express, { Request, Response } from 'express';
import { loginRequired, extractJWTPayload, validateRequest } from '@aichatwar/shared';
import { Feed } from '../models/feed/feed';
import { Post } from '../models/post/post';
import { Profile } from '../models/user/profile';
import { User } from '../models/user/user';
import { ReadOnlyAzureStorageGateway } from '../storage/azureStorageGateway';

const router = express.Router();

// Initialize read-only Azure Storage Gateway if credentials are available
// Note: For production, consider using a read-only storage account key or SAS token
let azureGateway: ReadOnlyAzureStorageGateway | null = null;
if (process.env.AZURE_STORAGE_ACCOUNT && process.env.AZURE_STORAGE_KEY) {
  azureGateway = new ReadOnlyAzureStorageGateway(
    process.env.AZURE_STORAGE_ACCOUNT,
    process.env.AZURE_STORAGE_KEY
  );
}

/**
 * GET /api/feeds
 * Query Params:
 *  - limit: number (default: 10)
 *  - cursor: timestamp or feedId (for pagination)
 */
router.get('/api/feeds', 
    loginRequired, 
    extractJWTPayload, 
    async (req: Request, res: Response) => {
  const userId = req.jwtPayload!.id;
  const limit = parseInt((req.query.limit as string) || '10', 10);
  const cursor = req.query.cursor as string | undefined;

  // Pagination filter: fetch posts before cursor
  const query: any = { userId };

  if (cursor) {
    const cursorFeed = await Feed.findById(cursor);
    if (cursorFeed) {
      query.createdAt = { $lt: cursorFeed.createdAt };
    }
  }

  // Fetch feed entries - sort by createdAt (newest first)
  const feeds = await Feed.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  if (!feeds.length) {
    return res.send({ items: [], nextCursor: null });
  }

  // Extract postIds for this batch
  const postIds = feeds.map(f => f.postId);

  // Fetch projected post data - sort by createdAt (newest first) using database index
  const posts = await Post.find({ _id: { $in: postIds } })
    .sort({ createdAt: -1 })
    .lean()
    .exec();

  // Fetch profile info of authors
  const authorIds = Array.from(new Set(posts.map(p => p.userId)));
  const profiles = await Profile.find({ userId: { $in: authorIds } })
    .select('userId username avatarUrl')
    .lean();

  // Fetch user information for fallback (email)
  const users = await User.find({ _id: { $in: authorIds } })
    .select('_id email')
    .lean();

  // Map posts by id for easy lookup
  const postMap = new Map(posts.map(p => [p._id, p]));
  
  // Create maps for profile and user lookup
  const profileMap = new Map(profiles.map((p: any) => [p.userId, p]));
  const userMap = new Map(users.map((u: any) => {
    const userId = typeof u._id === 'string' ? u._id : u._id.toString();
    return [userId, u];
  }));

  // Create a map of feedId to feed for lookup
  const feedMap = new Map(feeds.map(f => [f.postId, f]));

  // Build items array using the sorted posts order (newest first)
  // This maintains the database sort order without JavaScript sorting
  const items = await Promise.all(posts.map(async (post) => {
    const postId = post._id?.toString();
    const feed = feedMap.get(postId);
    if (!feed) return null;
    
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
      if (postUserId === userId) {
        displayName = 'You';
      } else if (postUserId) {
        displayName = `User ${postUserId.slice(0, 8)}`;
      } else {
        displayName = 'User';
      }
    }
    
    // Generate signed URLs for media if Azure gateway is available
    let mediaWithSignedUrls = post.media;
    if (azureGateway && post.media && Array.isArray(post.media) && post.media.length > 0) {
      console.log('Processing media for post:', post._id, 'Media count:', post.media.length);
      
      // Filter out invalid media items (where url === id, meaning it's just a mediaId, not a real URL)
      const validMediaItems = post.media.filter((mediaItem: any) => {
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
        console.log('No valid media items after filtering for post:', post._id);
      }
    } else {
      console.log('Media processing skipped:', {
        hasGateway: !!azureGateway,
        hasMedia: !!post.media,
        isArray: Array.isArray(post.media),
        mediaLength: post.media?.length || 0
      });
    }
    
    return {
      feedId: feed._id,
      postId: post._id,
      author: {
        userId: post.userId,
        name: displayName,
        avatarUrl: profile?.avatarUrl,
      },
      content: post.content,
      media: mediaWithSignedUrls,
      visibility: post.visibility,
      reactionsSummary: post.reactionsSummary,
      commentsCount: post.commentsCount,
      createdAt: post.createdAt || post.originalCreation,
    };
  }));
  
  // Filter out null items
  const filteredItems = items.filter(Boolean);

  const nextCursor = feeds[feeds.length - 1]._id;

  res.send({ items: filteredItems, nextCursor });
});

export { router as getFeedRouter };
