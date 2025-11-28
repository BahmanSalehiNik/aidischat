import { redisPublisher } from '../../redis';
import { EachMessagePayload } from 'kafkajs';
import { Listener, MessageReactionCreatedEvent, Subjects } from '@aichatwar/shared';

/**
 * MessageReactionCreatedListener
 * 
 * FAN-OUT ARCHITECTURE:
 * This listener runs on ONE Gateway pod (thanks to Kafka consumer group).
 * It receives message.reaction.created events from Kafka and triggers Redis pub/sub fan-out.
 * 
 * Note: All listeners use the same groupId 'realtime-gateway-group' to ensure
 * only one pod processes each message, then fans out via Redis.
 */
export class MessageReactionCreatedListener extends Listener<MessageReactionCreatedEvent> {
  readonly topic = Subjects.MessageReactionCreated;
  readonly groupId = 'realtime-gateway-group';

  async onMessage(data: MessageReactionCreatedEvent['data'], kafkaPayload: EachMessagePayload) {
    try {
      console.log(`📥 [MessageReactionCreatedListener] Received reaction.created event:`, {
        messageId: data.messageId,
        roomId: data.roomId,
        emoji: data.reaction?.emoji,
        userId: data.reaction?.userId,
        reactionsSummary: data.reactionsSummary,
      });
      
      // Normalize roomId to ensure consistency (trim whitespace)
      const normalizedRoomId = data.roomId?.trim();
      if (!normalizedRoomId) {
        console.error(`❌ [MessageReactionCreatedListener] Invalid roomId:`, data.roomId);
        throw new Error(`Invalid roomId: ${data.roomId}`);
      }
      
      const channel = `room:${normalizedRoomId}`;
      
      // FAN-OUT TRIGGER: Publish to Redis (all Gateway pods will receive this)
      const redisPayload = {
        type: 'message.reaction.created',
        messageId: data.messageId,
        roomId: normalizedRoomId, // Use normalized roomId
        reaction: data.reaction,
        reactionsSummary: data.reactionsSummary,
      };
      
      await redisPublisher.publish(channel, JSON.stringify(redisPayload));
      
      console.log(`📤 [Kafka→Redis] Published message.reaction.created to channel ${channel} (fan-out trigger)`, {
        channel,
        messageId: data.messageId,
        roomId: data.roomId,
        payloadSize: JSON.stringify(redisPayload).length,
      });
      
      // Note: In the old pattern with shared consumer, ack is handled in index.ts
      // This method is kept for compatibility but won't be called in the old pattern
    } catch (error) {
      console.error(`❌ [MessageReactionCreatedListener] Error processing message:`, error);
      throw error; // Re-throw so base class can handle retry logic if needed
    }
  }
}

