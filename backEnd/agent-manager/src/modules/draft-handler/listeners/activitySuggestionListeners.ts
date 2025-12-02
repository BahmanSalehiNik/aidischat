import { Listener, Subjects, EachMessagePayload, Visibility } from '@aichatwar/shared';
import {
  AgentActivityPostSuggestedEvent,
  AgentActivityCommentSuggestedEvent,
  AgentActivityReactionSuggestedEvent,
} from '@aichatwar/shared';
import { draftHandler } from '../draftHandler';
import { AgentDraftCreatedPublisher } from '../../../events/publishers/agentManagerPublishers';
import { kafkaWrapper } from '../../../kafka-client';

export class AgentActivityPostSuggestedListener extends Listener<AgentActivityPostSuggestedEvent> {
  readonly topic = Subjects.AgentActivityPostSuggested;
  readonly groupId = 'agent-manager-activity-post-suggested';

  async onMessage(data: AgentActivityPostSuggestedEvent['data'], msg: EachMessagePayload): Promise<void> {
    console.log(`[AgentActivityPostSuggestedListener] Received post suggestion for agent ${data.agentId}`);

    try {
      // Create draft from suggestion
      const draft = await draftHandler.createPostDraft({
        agentId: data.agentId,
        ownerUserId: data.ownerUserId,
        content: data.suggestedContent,
        visibility: Visibility.Public, // Default, can be adjusted
        metadata: {
          suggestedBy: 'activity_worker',
          confidence: data.confidence,
          context: data.context,
        },
      });

      // Publish draft created event
      await new AgentDraftCreatedPublisher(kafkaWrapper.producer).publish({
        draftId: draft.id,
        agentId: draft.agentId,
        ownerUserId: draft.ownerUserId,
        type: 'post',
        timestamp: new Date().toISOString(),
      });

      console.log(`[AgentActivityPostSuggestedListener] Created post draft ${draft.id} for agent ${data.agentId}`);
      await this.ack();
    } catch (error: any) {
      console.error(`[AgentActivityPostSuggestedListener] Error creating post draft:`, error);
      // Still ack to avoid infinite retries for business logic errors
      if (error.message?.includes('Maximum pending drafts')) {
        await this.ack();
      } else {
        throw error;
      }
    }
  }
}

export class AgentActivityCommentSuggestedListener extends Listener<AgentActivityCommentSuggestedEvent> {
  readonly topic = Subjects.AgentActivityCommentSuggested;
  readonly groupId = 'agent-manager-activity-comment-suggested';

  async onMessage(data: AgentActivityCommentSuggestedEvent['data'], msg: EachMessagePayload): Promise<void> {
    console.log(`[AgentActivityCommentSuggestedListener] Received comment suggestion for agent ${data.agentId}`);

    try {
      const draft = await draftHandler.createCommentDraft({
        agentId: data.agentId,
        ownerUserId: data.ownerUserId,
        postId: data.postId,
        content: data.suggestedContent,
        metadata: {
          suggestedBy: 'activity_worker',
          confidence: data.confidence,
          context: data.context,
        },
      });

      await new AgentDraftCreatedPublisher(kafkaWrapper.producer).publish({
        draftId: draft.id,
        agentId: draft.agentId,
        ownerUserId: draft.ownerUserId,
        type: 'comment',
        timestamp: new Date().toISOString(),
      });

      console.log(`[AgentActivityCommentSuggestedListener] Created comment draft ${draft.id} for agent ${data.agentId}`);
      await this.ack();
    } catch (error: any) {
      console.error(`[AgentActivityCommentSuggestedListener] Error creating comment draft:`, error);
      if (error.message?.includes('Maximum pending drafts')) {
        await this.ack();
      } else {
        throw error;
      }
    }
  }
}

export class AgentActivityReactionSuggestedListener extends Listener<AgentActivityReactionSuggestedEvent> {
  readonly topic = Subjects.AgentActivityReactionSuggested;
  readonly groupId = 'agent-manager-activity-reaction-suggested';

  async onMessage(data: AgentActivityReactionSuggestedEvent['data'], msg: EachMessagePayload): Promise<void> {
    console.log(`[AgentActivityReactionSuggestedListener] Received reaction suggestion for agent ${data.agentId}`);

    try {
      const draft = await draftHandler.createReactionDraft({
        agentId: data.agentId,
        ownerUserId: data.ownerUserId,
        targetType: data.targetType,
        targetId: data.targetId,
        reactionType: data.reactionType,
        metadata: {
          suggestedBy: 'activity_worker',
          confidence: data.confidence,
          context: data.context,
        },
      });

      await new AgentDraftCreatedPublisher(kafkaWrapper.producer).publish({
        draftId: draft.id,
        agentId: draft.agentId,
        ownerUserId: draft.ownerUserId,
        type: 'reaction',
        timestamp: new Date().toISOString(),
      });

      console.log(`[AgentActivityReactionSuggestedListener] Created reaction draft ${draft.id} for agent ${data.agentId}`);
      await this.ack();
    } catch (error: any) {
      console.error(`[AgentActivityReactionSuggestedListener] Error creating reaction draft:`, error);
      if (error.message?.includes('Maximum pending drafts')) {
        await this.ack();
      } else {
        throw error;
      }
    }
  }
}

