// routes/create-post.ts
import express, { Request, Response } from 'express';
import { extractJWTPayload, loginRequired, validateRequest } from '@aichatwar/shared';
import { Post } from '../../models/post';

const router = express.Router();

router.post('/api/posts', extractJWTPayload, loginRequired, 
  async (req: Request, res: Response) => {
  const { id, content, mediaIds, visibility, version } = req.body;

  const post = Post.build({
    id: id,
    userId: req.jwtPayload!.id,
    content,
    mediaIds,
    visibility,
    version
  });

  await post.save();
  res.status(201).send(post);
});

export { router as createPostRouter };
