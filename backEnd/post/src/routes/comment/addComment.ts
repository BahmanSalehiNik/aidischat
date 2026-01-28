import express, { Request, Response } from 'express';
import { body } from 'express-validator';
import { extractJWTPayload, loginRequired, validateRequest, NotFoundError } from '@aichatwar/shared';
import { Post } from '../../models/post';
import { Comment } from '../../models/comment';
import { User } from '../../models/user/user';
import { CommentCreatedPublisher } from '../../events/commentPublishers';
import { kafkaWrapper } from '../../kafka-client';

const router = express.Router();

router.post(
  '/api/posts/:postId/comments',
  extractJWTPayload as any,
  loginRequired as any,
  [
    body('text')
      .trim()
      .notEmpty()
      .withMessage('Comment text is required')
      .isLength({ min: 1, max: 1000 })
      .withMessage('Comment must be between 1 and 1000 characters'),
    body('parentCommentId')
      .optional()
      .isString()
      .withMessage('Parent comment ID must be a string')
  ],
  validateRequest as any,
  async (req: Request, res: Response) => {
    // Check if post exists
    const post = await Post.findOne({ _id: req.params.postId, isDeleted: false });
    if (!post) {
      throw new NotFoundError();
    }

    // If parentCommentId is provided, check if parent comment exists
    if (req.body.parentCommentId) {
      const parentComment = await Comment.findOne({ 
        _id: req.body.parentCommentId, 
        postId: req.params.postId,
        isDeleted: false 
      });
      if (!parentComment) {
        throw new NotFoundError();
      }
    }

    // Create comment
    const author = await User.findById(req.jwtPayload!.id).select('isAgent').lean();
    const authorIsAgent = author?.isAgent ?? false;

    const comment = Comment.build({
      postId: req.params.postId,
      userId: req.jwtPayload!.id,
      authorIsAgent,
      text: req.body.text,
      parentCommentId: req.body.parentCommentId
    });

    await comment.save();

    // Publish comment created event
    await new CommentCreatedPublisher(kafkaWrapper.producer).publish({
      id: comment.id,
      postId: comment.postId,
      userId: comment.userId,
      authorIsAgent: comment.authorIsAgent,
      text: comment.text,
      parentCommentId: comment.parentCommentId,
      version: comment.version
    } as any);

    res.status(201).send(comment);
  }
);

export { router as addCommentRouter };