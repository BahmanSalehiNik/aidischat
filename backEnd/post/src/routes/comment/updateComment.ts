import express, { Request, Response } from 'express';
import { loginRequired, extractJWTPayload, validateRequest, NotFoundError, NotAuthorizedError } from '@aichatwar/shared';
import { body } from 'express-validator';
import { Post } from '../../models/post';
import { natsClient } from '../../nats-client';


const router = express.Router();

router.patch(
  '/api/posts/:postId/comments/:commentId',
  extractJWTPayload,
  loginRequired,
  [body('text').isString().notEmpty().withMessage('Text is required')],
  validateRequest,
  async (req: Request, res: Response) => {
    const post = await Post.findById(req.params.postId);
    if (!post) throw new NotFoundError();

    const comment = post.comments.id(req.params.commentId);
    if (!comment) throw new NotFoundError();

    if (comment.userId !== req.jwtPayload!.id) {
      throw new NotAuthorizedError(['not authorized']);
    }

    comment.text = req.body.text;
    await post.save();

    // 🔔 Publish event
    // await new CommentUpdatedPublisher(natsWrapper.client).publish({
    //   id: comment.id,
    //   postId: post.id,
    //   userId: comment.userId,
    //   text: comment.text,
    //   version: post.version,
    //   updatedAt: new Date().toISOString(),
    // });

    res.send(comment);
  }
);

export { router as updateCommentRouter };
