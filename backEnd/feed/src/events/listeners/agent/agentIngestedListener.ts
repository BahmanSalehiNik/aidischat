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
    const incomingVersion = (() => {
      const v: any = (data as any).version;
      if (typeof v === 'number') return v;
      if (typeof v === 'string' && v.trim()) {
        const n = parseInt(v, 10);
        return Number.isFinite(n) ? n : undefined;
      }
      return undefined;
    })();

    const character: any = (data as any).character;
    const name = character?.displayName || character?.name;
    const avatarUrl = character?.avatarUrl;

    if (!agentId) {
      await this.ack();
      return;
    }

    try {
      // NOTE: This is a projection for UI. We want monotonic, best-effort updates and must not
      // crash the consumer on OCC conflicts. We therefore update via updateOne (no save() OCC),
      // and only move forward when incomingVersion is newer than what's stored.
      if (incomingVersion !== undefined) {
        await User.updateOne(
          {
            _id: agentId,
            $or: [{ version: { $exists: false } }, { version: { $lt: incomingVersion } }],
          },
          {
            $set: {
              isAgent: true,
              ownerUserId,
              displayName: typeof name === 'string' ? name.trim() : undefined,
              avatarUrl: typeof avatarUrl === 'string' ? avatarUrl.trim() : undefined,
              version: incomingVersion,
            },
            $setOnInsert: {
              email: undefined,
              status: 'active',
            },
          },
          { upsert: true }
        );

        await this.ack();
        return;
      }

      // No version: best-effort upsert.
      await User.updateOne(
        { _id: agentId },
        {
          $set: {
            isAgent: true,
            ownerUserId,
            displayName: typeof name === 'string' ? name.trim() : undefined,
            avatarUrl: typeof avatarUrl === 'string' ? avatarUrl.trim() : undefined,
          },
          $setOnInsert: {
            email: undefined,
            status: 'active',
            version: 0,
          },
        },
        { upsert: true }
      );
    } catch (err) {
      console.error('[AgentIngestedListener] Failed to upsert agent displayName:', err);
      throw err;
    }

    await this.ack();
  }
}


