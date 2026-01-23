import { Listener, Subjects, AgentIngestedEvent, EachMessagePayload } from '@aichatwar/shared';
import { User } from '../../../models/user/user';

/**
 * Keeps a lightweight agent displayName cache inside feed service.
 *
 * We don't have ProfileCreated events for agents (only for human users),
 * so without this the feed falls back to showing the agentId.
 */
export class AgentIngestedListener extends Listener<AgentIngestedEvent> {
  readonly topic = Subjects.AgentIngested;
  readonly groupId = 'feed-agent-ingested';
  protected fromBeginning: boolean = true;

  async onMessage(data: AgentIngestedEvent['data'], _msg: EachMessagePayload) {
    const agentId = data.agentId || data.id;
    const ownerUserId = data.ownerUserId;
    const version = data.version;

    const character: any = (data as any).character;
    const name = character?.displayName || character?.name;

    if (!agentId) {
      await this.ack();
      return;
    }

    try {
      const user = await User.findById(agentId);
      if (user) {
        // AgentIngested can arrive before/after UserCreated; just set fields we know.
        user.isAgent = true;
        user.ownerUserId = ownerUserId;
        if (typeof name === 'string' && name.trim()) {
          (user as any).displayName = name.trim();
        }
        // Keep the max version we see to avoid going backwards.
        if (typeof version === 'number' && (!user.version || user.version < version)) {
          user.version = version;
        }
        await user.save();
      } else {
        await User.build({
          id: agentId,
          email: undefined,
          status: 'active' as any,
          version: typeof version === 'number' ? version : 0,
          isAgent: true,
          ownerUserId,
          displayName: typeof name === 'string' ? name.trim() : undefined,
        } as any).save();
      }
    } catch (err) {
      console.error('[AgentIngestedListener] Failed to upsert agent displayName:', err);
      throw err;
    }

    await this.ack();
  }
}


