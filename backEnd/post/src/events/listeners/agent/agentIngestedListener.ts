import { AgentIngestedEvent, EachMessagePayload, Listener, Subjects } from '@aichatwar/shared';
import { User } from '../../../models/user/user';
import { GroupIdAgentIngested } from '../../queGroupNames';

/**
 * Projection listener for agents.
 *
 * Post service needs agent displayName/avatarUrl for post detail views and comment author rendering.
 * Agents do not emit Profile events like humans, so we consume agent.ingested to keep this cache updated.
 */
export class AgentIngestedListener extends Listener<AgentIngestedEvent> {
  readonly topic = Subjects.AgentIngested;
  groupId: string = GroupIdAgentIngested;
  protected fromBeginning: boolean = true;

  async onMessage(data: AgentIngestedEvent['data'], _msg: EachMessagePayload) {
    const agentId = (data as any).agentId || (data as any).id;
    const ownerUserId = (data as any).ownerUserId;
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

    // Best-effort, monotonic projection updates.
    //
    // IMPORTANT: Don't use a version-guarded filter with upsert=true directly.
    // If an older/out-of-order event arrives (incomingVersion <= stored version),
    // the filter won't match and Mongo will attempt an insert with the same _id -> E11000.
    // We therefore check the stored version first and only update when we move forward.
    const id = String(agentId);
    const existing = await User.findById(id).select('version').lean();

    if (incomingVersion !== undefined) {
      const storedVersion = (existing as any)?.version;
      if (typeof storedVersion === 'number' && storedVersion >= incomingVersion) {
        await this.ack();
        return;
      }

      if (!existing) {
        await User.updateOne(
          { _id: id },
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

      await User.updateOne(
        { _id: id },
        {
          $set: {
            isAgent: true,
            ownerUserId,
            displayName: typeof name === 'string' ? name.trim() : undefined,
            avatarUrl: typeof avatarUrl === 'string' ? avatarUrl.trim() : undefined,
            version: incomingVersion,
          },
        }
      );

      await this.ack();
      return;
    }

    // No version: only upsert if missing; otherwise just best-effort update fields.
    if (!existing) {
      await User.updateOne(
        { _id: id },
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
    } else {
      await User.updateOne(
        { _id: id },
        {
          $set: {
            isAgent: true,
            ownerUserId,
            displayName: typeof name === 'string' ? name.trim() : undefined,
            avatarUrl: typeof avatarUrl === 'string' ? avatarUrl.trim() : undefined,
          },
        }
      );
    }

    await this.ack();
  }
}


