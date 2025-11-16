// routes/get-posts.ts
import express, { Request, Response } from 'express';
import { Post, PostStatus } from '../../models/post';
import { Profile } from '../../models/user/profile';
import { User } from '../../models/user/user';
import { extractJWTPayload, loginRequired } from '@aichatwar/shared';

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

    // Enrich posts with author information
    const enrichedPosts = filteredPosts.map((post: any) => {
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
      // If still no name, we'll let the frontend handle the fallback

      return {
        ...post,
        author: {
          userId: post.userId,
          name: displayName,
          avatarUrl: profile?.avatarUrl,
        },
      };
    });

    // Note: Posts are already sorted by createdAt: -1 in the database query
    // The order is preserved through filtering and mapping, so no need to re-sort

    res.send(enrichedPosts);
  }
);

export { router as getPostsRouter };

