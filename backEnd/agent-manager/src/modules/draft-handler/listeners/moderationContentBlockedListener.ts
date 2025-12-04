import { Listener, Subjects, EachMessagePayload } from '@aichatwar/shared';
import { ModerationContentBlockedEvent } from '@aichatwar/shared';
import { draftHandler } from '../draftHandler';
import { AgentDraftPost } from '../../../models/agent-draft-post';
import { AgentDraftComment } from '../../../models/agent-draft-comment';
import { AgentDraftReaction } from '../../../models/agent-draft-reaction';
import { AgentDraftRejectedPublisher } from '../../../events/publishers/agentManagerPublishers';
import { kafkaWrapper } from '../../../kafka-client';

export class ModerationContentBlockedDraftListener extends Listener<ModerationContentBlockedEvent> {
  readonly topic = Subjects.ModerationContentBlocked;
  readonly groupId = 'agent-manager-moderation-content-blocked-draft';

  async onMessage(data: ModerationContentBlockedEvent['data'], msg: EachMessagePayload): Promise<void> {
    // Only handle draft content
    if (data.contentType !== 'draft') {
      await this.ack();
      return;
    }

    console.log(`[ModerationContentBlockedDraftListener] Draft ${data.contentId} blocked for agent ${data.agentId}`);

    try {
      // Find the draft (could be post, comment, or reaction)
      let draft: any = null;
      let draftType: 'post' | 'comment' | 'reaction' | null = null;

      draft = await AgentDraftPost.findById(data.contentId);
      if (draft) {
        draftType = 'post';
      } else {
        draft = await AgentDraftComment.findById(data.contentId);
        if (draft) {
          draftType = 'comment';
        } else {
          draft = await AgentDraftReaction.findById(data.contentId);
          if (draft) {
            draftType = 'reaction';
          }
        }
      }

      if (!draft || !draftType) {
        console.warn(`[ModerationContentBlockedDraftListener] Draft ${data.contentId} not found`);
        await this.ack();
        return;
      }

      // Only reject if still pending
      if (draft.status === 'pending') {
        await draftHandler.rejectDraft(data.contentId, draft.ownerUserId, draftType, data.reason);

        await new AgentDraftRejectedPublisher(kafkaWrapper.producer).publish({
          draftId: draft.id,
          agentId: draft.agentId,
          ownerUserId: draft.ownerUserId,
          reason: data.reason,
          timestamp: new Date().toISOString(),
        });

        console.log(`[ModerationContentBlockedDraftListener] Draft ${data.contentId} rejected due to moderation`);
      }

      await this.ack();
    } catch (error: any) {
      console.error(`[ModerationContentBlockedDraftListener] Error rejecting draft:`, error);
      throw error;
    }
  }
}

