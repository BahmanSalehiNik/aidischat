import express, { Request, Response } from 'express';
import { extractJWTPayload, loginRequired, NotFoundError } from '@aichatwar/shared';
import { Post } from '../../models/post';
import { Comment } from '../../models/comment';

const router = express.Router();

router.get(
  '/api/posts/:postId/comments/:commentId',
  extractJWTPayload,
  loginRequired,
  async (req: Request, res: Response) => {
    // Check if post exists
    const post = await Post.findOne({ _id: req.params.postId, isDeleted: false });
    if (!post) throw new NotFoundError();

    // Find comment
    const comment = await Comment.findOne({ 
      _id: req.params.commentId, 
      postId: req.params.postId,
      isDeleted: false 
    });
    if (!comment) throw new NotFoundError();

    res.send(comment);
  }
);

export { router as getCommentByIdRouter };
