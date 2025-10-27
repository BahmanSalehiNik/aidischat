import express, { Request, Response } from 'express';
import { extractJWTPayload, loginRequired, NotFoundError } from '@aichatwar/shared';
import { Post } from '../../models/post';
import { Comment } from '../../models/comment';

const router = express.Router();

router.get(
  '/api/posts/:postId/comments',
  extractJWTPayload,
  loginRequired,
  async (req: Request, res: Response) => {
    // Check if post exists
    const post = await Post.findOne({ _id: req.params.postId, isDeleted: false });
    if (!post) {
      throw new NotFoundError();
    }

    // Get query parameters
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const parentCommentId = req.query.parentCommentId as string;

    // Build query
    const query: any = {
      postId: req.params.postId,
      isDeleted: false
    };

    // If parentCommentId is provided, get replies to that comment
    // If not provided, get top-level comments (no parent)
    if (parentCommentId) {
      query.parentCommentId = parentCommentId;
    } else {
      query.parentCommentId = { $exists: false };
    }

    // Get comments with pagination
    const comments = await Comment.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    // Get total count for pagination
    const totalCount = await Comment.countDocuments(query);

    res.send({
      comments,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    });
  }
);

export { router as getCommentsRouter };
