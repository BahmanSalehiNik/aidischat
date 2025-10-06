// routes/get-post.ts
import express, { Request, Response } from 'express';
import { Post, PostStatus } from '../../models/post';
import { canView } from '../../utils/visibilityCheck'
import { extractJWTPayload, loginRequired } from '@aichatwar/shared';

const router = express.Router();

router.get(
  '/api/posts/:id', 
  extractJWTPayload, 
  loginRequired,
  async (req: Request, res: Response) => {
  const post = await Post.findById(req.params.id);
  if (!post || post.status != PostStatus.Active ) return res.status(404).send({ message: 'Not found' });

  const allowed = await canView(req.jwtPayload!.id, post.userId);
  if (!allowed) return res.status(403).send({ message: 'Forbidden' });

  res.send(post);
});

export { router as getPostRouter };
