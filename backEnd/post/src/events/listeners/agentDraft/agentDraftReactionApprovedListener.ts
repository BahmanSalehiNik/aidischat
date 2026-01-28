import { Listener, Subjects, AgentDraftReactionApprovedEvent, EachMessagePayload } from '@aichatwar/shared';
import { Reaction } from '../../../models/reaction';
import { Post, PostStatus } from '../../../models/post';
import { Comment } from '../../../models/comment';
import { ReactionCreatedPublisher, ReactionDeletedPublisher } from '../../reactionPublishers';
import { kafkaWrapper } from '../../../kafka-client';

export class AgentDraftReactionApprovedListener extends Listener<AgentDraftReactionApprovedEvent> {
  readonly topic = Subjects.AgentDraftReactionApproved;
  readonly groupId = 'post-service-agent-draft-reaction-approved';
  protected fromBeginning: boolean = true;

  async onMessage(data: AgentDraftReactionApprovedEvent['data'], msg: EachMessagePayload): Promise<void> {
    const { agentId, targetType, targetId, reactionType } = data;

    console.log(`[AgentDraftReactionApprovedListener] Received approved agent reaction draft for agent ${agentId} on ${targetType} ${targetId}`);

    if (!agentId || !targetType || !targetId || !reactionType) {
      await this.ack();
      return;
    }

    // Only allow reacting to HUMAN content (no reacting to agent-authored posts/comments).
    if (targetType === 'post') {
      const post = await Post.findOne({ _id: targetId, isDeleted: false });
      if (!post || post.status !== PostStatus.Active) {
        console.warn(`[AgentDraftReactionApprovedListener] Post ${targetId} not found/inactive; skipping reaction creation`);
        await this.ack();
        return;
      }
      if ((post as any).authorIsAgent) {
        console.warn(`[AgentDraftReactionApprovedListener] Post ${targetId} is agent-authored; skipping reaction creation`);
        await this.ack();
        return;
      }

      const existing = await Reaction.findOne({ userId: agentId, postId: targetId, commentId: { $exists: false } });
      if (existing) {
        const previousType = existing.type as any;
        const nextType = reactionType as any;
        if (previousType !== nextType) {
          await new ReactionDeletedPublisher(kafkaWrapper.producer).publish({
            id: existing.id,
            userId: existing.userId,
            postId: existing.postId,
            commentId: existing.commentId,
            type: previousType,
          } as any);
        }

        existing.type = nextType;
        await existing.save();

        if (previousType !== nextType) {
          await new ReactionCreatedPublisher(kafkaWrapper.producer).publish({
            id: existing.id,
            userId: existing.userId,
            postId: existing.postId,
            commentId: existing.commentId,
            type: nextType,
            version: 0,
          } as any);
        }

        await this.ack();
        return;
      }

      const reaction = Reaction.build({ userId: agentId, postId: targetId, type: reactionType as any });
      await reaction.save();

      await new ReactionCreatedPublisher(kafkaWrapper.producer).publish({
        id: reaction.id,
        userId: reaction.userId,
        postId: reaction.postId,
        commentId: reaction.commentId,
        type: reaction.type as any,
        version: 0,
      } as any);

      await this.ack();
      return;
    }

    if (targetType === 'comment') {
      const comment = await Comment.findOne({ _id: targetId, isDeleted: false });
      if (!comment) {
        console.warn(`[AgentDraftReactionApprovedListener] Comment ${targetId} not found; skipping reaction creation`);
        await this.ack();
        return;
      }
      if ((comment as any).authorIsAgent) {
        console.warn(`[AgentDraftReactionApprovedListener] Comment ${targetId} is agent-authored; skipping reaction creation`);
        await this.ack();
        return;
      }

      const existing = await Reaction.findOne({ userId: agentId, commentId: targetId });
      if (existing) {
        existing.type = reactionType as any;
        await existing.save();

        await new ReactionCreatedPublisher(kafkaWrapper.producer).publish({
          id: existing.id,
          userId: existing.userId,
          postId: existing.postId,
          commentId: existing.commentId,
          type: existing.type as any,
          version: 0,
        } as any);

        await this.ack();
        return;
      }

      // For comment reactions, also include the parent postId (same as HTTP route does).
      const reaction = Reaction.build({ userId: agentId, commentId: targetId, postId: (comment as any).postId, type: reactionType as any });
      await reaction.save();

      await new ReactionCreatedPublisher(kafkaWrapper.producer).publish({
        id: reaction.id,
        userId: reaction.userId,
        postId: reaction.postId,
        commentId: reaction.commentId,
        type: reaction.type as any,
        version: 0,
      } as any);

      await this.ack();
      return;
    }

    // Unknown targetType
    await this.ack();
  }
}


