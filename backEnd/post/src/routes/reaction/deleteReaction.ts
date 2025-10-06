import express, { Request, Response } from 'express';
import { extractJWTPayload, loginRequired, NotFoundError, NotAuthorizedError } from '@aichatwar/shared';
import { Reaction } from '../../models/reaction';

const router = express.Router();

router.delete('/api/posts/:id/reactions', 
  extractJWTPayload, 
  loginRequired, 
  async (req: Request, res: Response) => {
  const userId = req.jwtPayload!.id;
  const postId = req.params.id;

  const reaction = await Reaction.findOne({ userId, postId });
  if (!reaction || reaction.commentId) throw new NotFoundError();

  if (reaction.userId !== userId) throw new NotAuthorizedError(['not authorized.']);

  await reaction.deleteOne();

  res.status(204).send({});
});

export { router as deletePostReactionRouter };
