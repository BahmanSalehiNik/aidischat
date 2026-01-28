import express, { Request, Response } from 'express';
import { extractJWTPayload, loginRequired, NotFoundError, NotAuthorizedError } from '@aichatwar/shared';
import { Post } from '../../models/post';
import { Comment } from '../../models/comment';
import { CommentDeletedPublisher } from '../../events/commentPublishers';
import { kafkaWrapper } from '../../kafka-client';

const router = express.Router();

router.delete(
  '/api/posts/:postId/comments/:commentId',
  extractJWTPayload as any,
  loginRequired as any,
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

    // Check if comment is already soft deleted
    if (comment.isDeleted) {
      throw new NotFoundError();
    }

    // Soft delete comment
    comment.isDeleted = true;
    comment.deletedAt = new Date();
    comment.text = '[deleted]'; // Replace text with deleted indicator
    await comment.save();

    // Publish comment deleted event
    await new CommentDeletedPublisher(kafkaWrapper.producer).publish({
      id: comment.id,
      postId: comment.postId,
      userId: comment.userId,
      authorIsAgent: comment.authorIsAgent,
      deletedAt: comment.deletedAt.toISOString()
    } as any);

    res.status(204).send();
  }
);

export { router as deleteCommentRouter };
