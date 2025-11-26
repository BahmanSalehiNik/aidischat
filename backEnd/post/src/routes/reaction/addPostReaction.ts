import express, { Request, Response } from 'express';
import { extractJWTPayload, loginRequired, BadRequestError, NotFoundError } from '@aichatwar/shared';
import { body } from 'express-validator';
import { validateRequest } from '@aichatwar/shared';
import { Reaction } from '../../models/reaction';
import { Post, PostStatus } from '../../models/post';
import { ReactionCreatedPublisher, ReactionDeletedPublisher } from '../../events/reactionPublishers';
import { kafkaWrapper } from '../../kafka-client';

const router = express.Router();

router.post(
  '/api/posts/:postId/reactions',
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
    const postId = req.params.postId;

    // Check if post exists
    const post = await Post.findOne({ _id: postId, isDeleted: false });
    if (!post || post.status !== PostStatus.Active) {
      throw new NotFoundError();
    }

    // Check if user already has a reaction on this post
    const existing = await Reaction.findOne({ userId, postId, commentId: { $exists: false } });
    
    if (existing) {
      const previousType = existing.type as 'like' | 'love' | 'haha' | 'sad' | 'angry';
      const nextType = type as 'like' | 'love' | 'haha' | 'sad' | 'angry';

      // If changing reaction type, publish deleted for old type first
      if (previousType !== nextType) {
        await new ReactionDeletedPublisher(kafkaWrapper.producer).publish({
          id: existing.id,
          userId: existing.userId,
          postId: existing.postId,
          commentId: existing.commentId,
          type: previousType,
        });
      }
      
      // Update existing reaction
      existing.type = nextType;
      await existing.save();

      // Publish reaction created/updated event only when the type actually changed
      if (previousType !== nextType) {
        await new ReactionCreatedPublisher(kafkaWrapper.producer).publish({
          id: existing.id,
          userId: existing.userId,
          postId: existing.postId,
          commentId: existing.commentId,
          type: nextType,
          version: 0,
        });
      }

      return res.status(200).send(existing);
    }

    // Create new reaction
    const reaction = Reaction.build({ userId, postId, type });
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

export { router as addPostReactionRouter };

