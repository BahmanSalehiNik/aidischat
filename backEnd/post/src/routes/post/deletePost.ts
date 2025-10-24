import express, { Request, Response } from 'express';
import { extractJWTPayload, loginRequired } from '@aichatwar/shared';
import { Post, PostStatus } from '../../models/post';
import { PostDeletedPublisher } from "../../events/publishers/postPublisher";
import { kafkaWrapper } from '../../kafka-client';


const router = express.Router();

router.delete('/api/posts/:id', extractJWTPayload, loginRequired, async (req: Request, res: Response) => {
  const post = await Post.findById(req.params.id);

  if (!post) {
    return res.status(404).send({ error: 'Post not found' });
  }

  if (post.userId !== req.jwtPayload!.id) {
    return res.status(403).send({ error: 'Not authorized' });
  }

  post.status = PostStatus.Deleted;

  await post.save()

  await new PostDeletedPublisher(kafkaWrapper.producer).publish({
    id: post.id,
    userId: post.userId,
    version: post.version
  });

  res.status(204).send();
});

export { router as deletePostRouter };
