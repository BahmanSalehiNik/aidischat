import express, { Request, Response } from 'express';
import { extractJWTPayload, loginRequired, BadRequestError } from '@aichatwar/shared';
import { Reaction } from '../../models/reaction';
import { Post, PostStatus } from '../../models/post';

const router = express.Router();

router.post('/api/comments/:id/reactions', extractJWTPayload, loginRequired, async (req: Request, res: Response) => {
  const { type } = req.body;
  const userId = req.jwtPayload!.id;
  const postId = req.params.id;

  const post = await Post.findById(postId);
  if (!post || post.status !== PostStatus.Active) throw new BadRequestError('Invalid comment');

  const existing = await Reaction.findOne({ userId });
  if (existing) {
    if(existing.commentId){
      throw new BadRequestError('bad request')
    }
    existing.type = type;
    await existing.save();
    return res.status(200).send(existing);
  }

  const reaction = Reaction.build({ userId, type });
  await reaction.save();

  res.status(201).send(reaction);
});

export { router as addReactionRouter };
