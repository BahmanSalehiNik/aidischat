import express, { Request, Response } from 'express';
import { loginRequired, extractJWTPayload, validateRequest, NotFoundError, NotAuthorizedError } from '@aichatwar/shared';
import { body } from 'express-validator';
import { Post, PostStatus } from '../../models/post';
import { natsClient } from '../../nats-client';
// import { PostUpdatedPublisher } from '../events/publishers/post-updated-publisher';

const router = express.Router();

router.patch(
  '/api/posts/:id',
  extractJWTPayload,
  loginRequired,
  [
    body('text').optional().isString().isLength({ min: 1 }).withMessage('Text must be valid'),
    body('mediaIds').optional().isArray().withMessage('MediaIds must be an array of strings'),
    body('visibility').optional().isIn(['public', 'friends', 'private']),
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    const post = await Post.findById(req.params.id);

    if (!post || post.status != PostStatus.Active ) {
      throw new NotFoundError();
    }

    if (post.userId !== req.jwtPayload!.id) {
      throw new NotAuthorizedError(['not authorized.']);
    }

    // ✅ Update only editable fields
    const { content, mediaIds, visibility } = req.body;

    if (content !== undefined) post.content = content;
    if (mediaIds !== undefined) post.mediaIds = mediaIds;
    if (visibility !== undefined) post.visibility = visibility;

    await post.save();

    // ✅ Publish event for other services
    // await new PostUpdatedPublisher(natsWrapper.client).publish({
    //   id: post.id,
    //   version: post.version,
    //   authorId: post.authorId,
    //   text: post.text,
    //   mediaIds: post.mediaIds,
    //   visibility: post.visibility,
    //   updatedAt: post.updatedAt.toISOString(),
    // });

    res.send(post);
  }
);

export { router as updatePostRouter };
