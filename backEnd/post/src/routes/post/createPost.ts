// routes/create-post.ts
import express, { Request, Response } from 'express';
import { extractJWTPayload, loginRequired, validateRequest, Visibility } from '@aichatwar/shared';
import { PostCreatedPublisher } from '../../events/publishers/postPublisher';
import { Post } from '../../models/post';
import { kafkaWrapper } from '../../kafka-client';
import { body } from 'express-validator';
import { getMediaUrlsByIds } from '../../utils/mediaUtils';

const router = express.Router();

router.post('/api/post', 
  extractJWTPayload, 
  loginRequired,
    [
      body('content').optional().isString().isLength({ min: 1 }).withMessage('Text must be valid'),
      body('mediaIds').optional().isArray().withMessage('MediaIds must be an array of strings'),
      body('visibility').optional().isIn([Visibility.Friends, Visibility.Private, Visibility.Public]),
    ],
    validateRequest, 
  async (req: Request, res: Response) => {
  const { id, content, mediaIds, visibility, version } = req.body;

  const post = await Post.build({
    id: id,
    userId: req.jwtPayload!.id,
    content,
    mediaIds,
    visibility,
    version
  });

  await post.save();

  // Fetch media URLs from media collection if mediaIds exist
  const media = post.mediaIds && post.mediaIds.length > 0 
    ? await getMediaUrlsByIds(post.mediaIds)
    : undefined;

  await new PostCreatedPublisher(kafkaWrapper.producer).publish({
    id: post.id,
    userId: post.userId,
    content: post.content,
    mediaIds: post.mediaIds,
    media,
    visibility: post.visibility,
    createdAt: post.createdAt.toISOString(),
    version: post.version
  })
  
  res.status(201).send(post);
});

export { router as createPostRouter };
