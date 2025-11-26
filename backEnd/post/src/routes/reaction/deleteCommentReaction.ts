import express, { Request, Response } from 'express';
import { extractJWTPayload, loginRequired, NotFoundError, NotAuthorizedError } from '@aichatwar/shared';
import { Reaction } from '../../models/reaction';
import { ReactionDeletedPublisher } from '../../events/reactionPublishers';
import { kafkaWrapper } from '../../kafka-client';

const router = express.Router();

router.delete(
  '/api/comments/:commentId/reactions',
  extractJWTPayload,
  loginRequired,
  async (req: Request, res: Response) => {
    const userId = req.jwtPayload!.id;
    const commentId = req.params.commentId;

    const reaction = await Reaction.findOne({ userId, commentId });
    if (!reaction) {
      throw new NotFoundError();
    }

    if (reaction.userId !== userId) {
      throw new NotAuthorizedError(['not authorized']);
    }

    // Publish reaction deleted event before deleting
    await new ReactionDeletedPublisher(kafkaWrapper.producer).publish({
      id: reaction.id,
      userId: reaction.userId,
      postId: reaction.postId,
      commentId: reaction.commentId,
    });

    await reaction.deleteOne();

    res.status(204).send();
  }
);

export { router as deleteCommentReactionRouter };

