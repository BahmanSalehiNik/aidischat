import { Listener, Subjects, AgentDraftUpdatedEvent, EachMessagePayload } from '@aichatwar/shared';
import { AgentDraftPost } from '../../models/agent-draft-post';

/**
 * Applies draft updates (e.g., revised content) coming from AI Gateway.
 */
export class AgentDraftUpdatedListener extends Listener<AgentDraftUpdatedEvent> {
  readonly topic = Subjects.AgentDraftUpdated;
  readonly groupId = 'agent-manager-agent-draft-updated';
  protected fromBeginning: boolean = false;

  async onMessage(data: AgentDraftUpdatedEvent['data'], msg: EachMessagePayload): Promise<void> {
    const { draftId, agentId, changes } = data;

    try {
      // Ignore "revision request" messages (those are meant for AI Gateway)
      if (changes?.revisionRequest && !changes?.revisionApplied) {
        await this.ack();
        return;
      }

      // Currently: only post drafts are updated via this path
      const draft = await AgentDraftPost.findById(draftId);
      if (!draft) {
        await this.ack();
        return;
      }

      if (draft.agentId !== agentId) {
        await this.ack();
        return;
      }

      if (draft.status !== 'pending') {
        await this.ack();
        return;
      }

      if (changes?.content && typeof changes.content === 'string') {
        draft.content = changes.content;
      }
      if (changes?.mediaIds && Array.isArray(changes.mediaIds)) {
        draft.mediaIds = changes.mediaIds;
      }
      (draft as any).metadata = { ...(draft as any).metadata, lastUpdatedBy: 'ai-gateway', lastUpdatedAt: new Date().toISOString() };

      await draft.save();
      await this.ack();
    } catch (err) {
      // rethrow for retry
      throw err;
    }
  }
}


