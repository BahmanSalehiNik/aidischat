import express, { Request, Response } from 'express';
import { extractJWTPayload, loginRequired, NotFoundError } from '@aichatwar/shared';
import { body } from 'express-validator';
import { validateRequest } from '@aichatwar/shared';
import { Reaction } from '../../models/reaction';
import { Comment } from '../../models/comment';
import { ReactionCreatedPublisher } from '../../events/reactionPublishers';
import { kafkaWrapper } from '../../kafka-client';

const router = express.Router();

router.post(
  '/api/comments/:commentId/reactions',
  extractJWTPayload,
  loginRequired,
  [
    body('type')
      .isIn(['like', 'love', 'haha', 'sad', 'angry'])
      .withMessage('Reaction type must be one of: like, love, haha, sad, angry'),
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    const { type } = req.body;
    const userId = req.jwtPayload!.id;
    const commentId = req.params.commentId;

    // Check if comment exists
    const comment = await Comment.findOne({ _id: commentId, isDeleted: false });
    if (!comment) {
      throw new NotFoundError();
    }

    // Check if user already has a reaction on this comment
    const existing = await Reaction.findOne({ userId, commentId });
    
    if (existing) {
      // Update existing reaction
      existing.type = type as 'like' | 'love' | 'haha' | 'sad' | 'angry';
      await existing.save();

      // Publish reaction updated event
      await new ReactionCreatedPublisher(kafkaWrapper.producer).publish({
        id: existing.id,
        userId: existing.userId,
        postId: existing.postId,
        commentId: existing.commentId,
        type: existing.type as 'like' | 'love' | 'haha' | 'sad' | 'angry',
        version: 0,
      });

      return res.status(200).send(existing);
    }

    // Create new reaction
    const reaction = Reaction.build({ userId, commentId, postId: comment.postId, type });
    await reaction.save();

    // Publish reaction created event
    await new ReactionCreatedPublisher(kafkaWrapper.producer).publish({
      id: reaction.id,
      userId: reaction.userId,
      postId: reaction.postId,
      commentId: reaction.commentId,
      type: reaction.type as 'like' | 'love' | 'haha' | 'sad' | 'angry',
      version: 0,
    });

    res.status(201).send(reaction);
  }
);

export { router as addCommentReactionRouter };

