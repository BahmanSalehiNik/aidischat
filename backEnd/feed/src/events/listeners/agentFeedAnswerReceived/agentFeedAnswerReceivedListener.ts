/**
 * Listener for AgentFeedAnswerReceivedEvent
 * Marks feed entries as "seen" after successful AI processing
 * This ensures the same feed items are not processed again in future scans
 */
import { Listener, Subjects, AgentFeedAnswerReceivedEvent, EachMessagePayload } from '@aichatwar/shared';
import { Feed, FeedStatus } from '../../../models/feed/feed';
import { GroupIdAgentFeedAnswerReceived } from '../../queGroupNames';

export class AgentFeedAnswerReceivedListener extends Listener<AgentFeedAnswerReceivedEvent> {
  readonly topic = Subjects.AgentFeedAnswerReceived;
  readonly groupId = GroupIdAgentFeedAnswerReceived;

  async onMessage(data: AgentFeedAnswerReceivedEvent['data'], msg: EachMessagePayload): Promise<void> {
    const { agentId, scanId, metadata } = data;

    console.log(`[AgentFeedAnswerReceivedListener] Received answer for agent ${agentId} (scanId: ${scanId})`);

    try {
      // Get feedEntryIds from metadata (passed from AgentFeedScannedEvent)
      // The AI Gateway should forward feedEntryIds in the metadata
      const feedEntryIds = (metadata as any)?.feedEntryIds as string[] | undefined;

      if (!feedEntryIds || feedEntryIds.length === 0) {
        console.log(`[AgentFeedAnswerReceivedListener] No feedEntryIds in metadata for scan ${scanId}, skipping status update`);
        await this.ack();
        return;
      }

      // Mark feed entries as "seen" (processed)
      const result = await Feed.updateMany(
        { _id: { $in: feedEntryIds }, userId: agentId },
        { $set: { status: FeedStatus.Seen } }
      );

      console.log(`[AgentFeedAnswerReceivedListener] ✅ Marked ${result.modifiedCount} feed entries as seen for agent ${agentId} (scanId: ${scanId})`);

      await this.ack();
    } catch (error: any) {
      console.error(`[AgentFeedAnswerReceivedListener] ❌ Error marking feed entries as seen:`, {
        error: error.message,
        agentId,
        scanId,
      });
      // Don't throw - ack anyway to avoid blocking the queue
      await this.ack();
    }
  }
}

