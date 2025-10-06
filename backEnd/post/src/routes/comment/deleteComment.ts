import express, { Request, Response } from 'express';
import { extractJWTPayload, loginRequired, NotFoundError, NotAuthorizedError } from '@aichatwar/shared';
import { Post } from '../../models/post';
import { natsClient } from '../../nats-client';
// import { CommentDeletedPublisher } from '../events/publishers/comment-deleted-publisher';

const router = express.Router();

router.delete(
  '/api/posts/:postId/comments/:commentId',
  extractJWTPayload,
  loginRequired,
  async (req: Request, res: Response) => {
    const post = await Post.findById(req.params.postId);
    if (!post) throw new NotFoundError();

    const comment = post.comments.id(req.params.commentId);
    if (!comment) throw new NotFoundError();

    if (comment.userId !== req.jwtPayload!.id) {
      throw new NotAuthorizedError(['']);
    }

    comment.deleted = true;
    comment.text = '[deleted]';
    await post.save();

    // await new CommentDeletedPublisher(natsWrapper.client).publish({
    //   id: comment.id,
    //   postId: post.id,
    //   userId: comment.userId,
    //   version: post.version,
    //   deletedAt: new Date().toISOString(),
    // });

    res.status(204).send();
  }
);

export { router as deleteCommentRouter };
