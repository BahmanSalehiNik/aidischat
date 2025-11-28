import { redisPublisher } from '../../redis';
import { EachMessagePayload } from 'kafkajs';
import { Listener, MessageReactionRemovedEvent, Subjects } from '@aichatwar/shared';

/**
 * MessageReactionRemovedListener
 * 
 * FAN-OUT ARCHITECTURE:
 * This listener runs on ONE Gateway pod (thanks to Kafka consumer group).
 * It receives message.reaction.removed events from Kafka and triggers Redis pub/sub fan-out.
 * 
 * Note: All listeners use the same groupId 'realtime-gateway-group' to ensure
 * only one pod processes each message, then fans out via Redis.
 */
export class MessageReactionRemovedListener extends Listener<MessageReactionRemovedEvent> {
  readonly topic = Subjects.MessageReactionRemoved;
  readonly groupId = 'realtime-gateway-group';

  async onMessage(data: MessageReactionRemovedEvent['data'], kafkaPayload: EachMessagePayload) {
    try {
      console.log(`📥 [MessageReactionRemovedListener] Received reaction.removed event:`, {
        messageId: data.messageId,
        roomId: data.roomId,
        userId: data.userId,
        reactionsSummary: data.reactionsSummary,
      });
      
      // Normalize roomId to ensure consistency (trim whitespace)
      const normalizedRoomId = data.roomId?.trim();
      if (!normalizedRoomId) {
        console.error(`❌ [MessageReactionRemovedListener] Invalid roomId:`, data.roomId);
        throw new Error(`Invalid roomId: ${data.roomId}`);
      }
      
      const channel = `room:${normalizedRoomId}`;
      
      // FAN-OUT TRIGGER: Publish to Redis (all Gateway pods will receive this)
      const redisPayload = {
        type: 'message.reaction.removed',
        messageId: data.messageId,
        roomId: normalizedRoomId, // Use normalized roomId
        userId: data.userId,
        reactionsSummary: data.reactionsSummary,
      };
      
      await redisPublisher.publish(channel, JSON.stringify(redisPayload));
      
      console.log(`📤 [Kafka→Redis] Published message.reaction.removed to channel ${channel} (fan-out trigger)`, {
        channel,
        messageId: data.messageId,
        roomId: data.roomId,
        payloadSize: JSON.stringify(redisPayload).length,
      });
      
      // Note: In the old pattern with shared consumer, ack is handled in index.ts
      // This method is kept for compatibility but won't be called in the old pattern
    } catch (error) {
      console.error(`❌ [MessageReactionRemovedListener] Error processing message:`, error);
      throw error; // Re-throw so base class can handle retry logic if needed
    }
  }
}

