// routes/create-post.ts
import express, { Request, Response } from 'express';
import { extractJWTPayload, loginRequired, validateRequest, Visability } from '@aichatwar/shared';
import { PostCreatedPublisher } from '../../events/publishers/postPublisher';
import { Post } from '../../models/post';
import { natsClient } from '../../nats-client';
import { body } from 'express-validator';

const router = express.Router();

router.post('/api/post', 
  extractJWTPayload, 
  loginRequired,
    [
      body('content').optional().isString().isLength({ min: 1 }).withMessage('Text must be valid'),
      body('mediaIds').optional().isArray().withMessage('MediaIds must be an array of strings'),
      body('visibility').optional().isIn([Visability.Friends, Visability.Private, Visability.Private]),
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

  await new PostCreatedPublisher(natsClient.client).publish({
    id:post.id,
    userId: post.userId,
    content: post.content,
    // TODO:  change the mediaIds type in post model
    mediaIds: post.mediaIds,//{ url: string; type: string }[]
    // TODO: make this type visibility 
    visibility: post.visibility,
    createdAt: post.createdAt.toISOString(),
    version: post.version
  })
  
  res.status(201).send(post);
});

export { router as createPostRouter };
