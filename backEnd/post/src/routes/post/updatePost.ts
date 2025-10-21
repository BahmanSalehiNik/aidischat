import express, { Request, Response } from 'express';
import { body } from 'express-validator';
import { loginRequired, extractJWTPayload, validateRequest, NotFoundError, NotAuthorizedError, Visability } from '@aichatwar/shared';
import { Post } from '../../models/post';
import { PostUpdatedPublisher } from "../../events/publishers/postPublisher";
import { natsClient } from "../../nats-client";

const router = express.Router();

router.patch(
  '/api/posts/:id',
  loginRequired,
  extractJWTPayload,
  [
    body('content').optional().isString().trim().isLength({ max: 5000 }),
    body('visibility')
      .optional()
      .isIn([Visability.Friends, Visability.Private, Visability.Public])
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
    await new PostUpdatedPublisher(natsClient.client).publish({
      id: post.id,
      userId: post.userId,
      content: post.content,
      mediaIds: post.mediaIds,
      visibility: Visability[post.visibility as keyof typeof Visability],
      status: post.status,
      reactions: reactionsArray,
      version: post.version,
      updatedAt: new Date().toISOString(),
      createdAt: post.createdAt.toISOString(),
      //TODO: Implement comment count
      commentCount: 0
    });

    res.status(200).send(post);
  }
);

export { router as updatePostRouter };
