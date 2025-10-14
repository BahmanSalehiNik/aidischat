import express, { Request, Response } from 'express';
import { loginRequired, extractJWTPayload, validateRequest } from '@aichatwar/shared';
import { Feed } from '../models/feed/feed';
import { Post } from '../models/post/post';
import { Profile } from '../models/user/profile';

const router = express.Router();

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
      query.timestamp = { $lt: cursorFeed.createdAt };
    }
  }

  // Fetch feed entries
  const feeds = await Feed.find(query)
    .sort({ timestamp: -1 })
    .limit(limit)
    .lean();

  if (!feeds.length) {
    return res.send({ items: [], nextCursor: null });
  }

  // Extract postIds for this batch
  const postIds = feeds.map(f => f.postId);

  // Fetch projected post data
  const posts = await Post.find({ _id: { $in: postIds } })
    .lean()
    .exec();

  // Optional: fetch profile info of authors
  const authorIds = Array.from(new Set(posts.map(p => p.userId)));
  const authors = await Profile.find({ userId: { $in: authorIds } })
    .select('userId name avatarUrl')
    .lean();

  // Map posts by id for easy lookup
  const postMap = new Map(posts.map(p => [p._id, p]));
  const authorMap = new Map(authors.map(a => [a.userId, a]));

  const items = feeds.map(feed => {
    const post = postMap.get(feed.postId);
    if (!post) return null;
    return {
      feedId: feed._id,
      postId: post._id,
      author: authorMap.get(post.userId) || null,
      content: post.content,
      media: post.media,
      visibility: post.visibility,
      reactionsSummary: post.reactionsSummary,
      commentsCount: post.commentsCount,
      createdAt: post.createdAt,
    };
  }).filter(Boolean);

  const nextCursor = feeds[feeds.length - 1]._id;

  res.send({ items, nextCursor });
});

export { router as getFeedRouter };
