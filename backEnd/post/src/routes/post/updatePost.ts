import express, { Request, Response } from 'express';
import { body } from 'express-validator';
import { loginRequired, extractJWTPayload, validateRequest, NotFoundError, NotAuthorizedError, Visibility } from '@aichatwar/shared';
import { Post } from '../../models/post';
import { PostUpdatedPublisher } from "../../events/publishers/postPublisher";
import { kafkaWrapper } from "../../kafka-client";

const router = express.Router();

router.patch(
  '/api/posts/:id',
  loginRequired,
  extractJWTPayload,
  [
    body('content').optional().isString().trim().isLength({ max: 5000 }),
    body('visibility')
      .optional()
      .isIn([Visibility.Friends, Visibility.Private, Visibility.Public])
      .withMessage('Invalid visibility'),
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    const post = await Post.findById(req.params.id);

    if (!post) {
      throw new NotFoundError();
    }

    if (post.userId !== req.jwtPayload!.id) {
      throw new NotAuthorizedError(['']);
    }

    const { content, visibility, mediaIds } = req.body;

    if (content) post.content = content;
    if (visibility) post.visibility = visibility;
    if (mediaIds) post.mediaIds = mediaIds;

    await post.save();

    // 🔢 Aggregate reactions for event (type -> count)
    const aggregatedReactions = post.reactions.reduce((acc: Record<string, number>, reaction) => {
      acc[reaction.type] = (acc[reaction.type] || 0) + 1;
      return acc;
    }, {});

    const reactionsArray = Object.entries(aggregatedReactions).map(([type, count]) => ({
      type,
      count,
    }));

    // 📡 Publish the event
    await new PostUpdatedPublisher(kafkaWrapper.producer).publish({
      id: post.id,
      userId: post.userId,
      content: post.content,
      mediaIds: post.mediaIds,
      visibility: post.visibility as Visibility,
      status: post.status,
      reactions: reactionsArray,
      version: post.version,
      updatedAt: new Date().toISOString(),
      createdAt: post.createdAt.toISOString(),
      commentCount: 0
    });

    res.status(200).send(post);
  }
);

export { router as updatePostRouter };
