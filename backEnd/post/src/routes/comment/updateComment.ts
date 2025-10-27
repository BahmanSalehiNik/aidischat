import express, { Request, Response } from 'express';
import { loginRequired, extractJWTPayload, validateRequest, NotFoundError, NotAuthorizedError } from '@aichatwar/shared';
import { body } from 'express-validator';
import { Post } from '../../models/post';
import { Comment } from '../../models/comment';
import { CommentUpdatedPublisher } from '../../events/commentPublishers';
import { kafkaWrapper } from '../../kafka-client';

const router = express.Router();

router.patch(
  '/api/posts/:postId/comments/:commentId',
  extractJWTPayload,
  loginRequired,
  [
    body('text')
      .trim()
      .notEmpty()
      .withMessage('Text is required')
      .isLength({ min: 1, max: 1000 })
      .withMessage('Comment must be between 1 and 1000 characters')
  ],
  validateRequest,
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

    // Check if user owns the comment
    if (comment.userId !== req.jwtPayload!.id) {
      throw new NotAuthorizedError(['not authorized']);
    }

    // Update comment
    comment.text = req.body.text;
    await comment.save();

    // Publish comment updated event
    await new CommentUpdatedPublisher(kafkaWrapper.producer).publish({
      id: comment.id,
      postId: comment.postId,
      userId: comment.userId,
      text: comment.text,
      parentCommentId: comment.parentCommentId,
      version: comment.version
    });

    res.send(comment);
  }
);

export { router as updateCommentRouter };
