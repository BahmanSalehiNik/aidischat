import { redisPublisher } from '../../redis';
import { EachMessagePayload } from 'kafkajs';
import { Listener, MessageReplyCreatedEvent, Subjects } from '@aichatwar/shared';

/**
 * MessageReplyCreatedListener
 * 
 * FAN-OUT ARCHITECTURE:
 * This listener runs on ONE Gateway pod (thanks to Kafka consumer group).
 * It receives message.reply.created events from Kafka and triggers Redis pub/sub fan-out.
 * 
 * Note: All listeners use the same groupId 'realtime-gateway-group' to ensure
 * only one pod processes each message, then fans out via Redis.
 */
export class MessageReplyCreatedListener extends Listener<MessageReplyCreatedEvent> {
  readonly topic = Subjects.MessageReplyCreated;
  readonly groupId = 'realtime-gateway-group';

  async onMessage(data: MessageReplyCreatedEvent['data'], payload: EachMessagePayload) {
    try {
      console.log(`📥 [MessageReplyCreatedListener] Received reply.created event:`, {
        messageId: data.messageId,
        roomId: data.roomId,
        replyToMessageId: data.replyToMessageId,
      });
      
      // Normalize roomId to ensure consistency (trim whitespace)
      const normalizedRoomId = data.roomId?.trim();
      if (!normalizedRoomId) {
        console.error(`❌ [MessageReplyCreatedListener] Invalid roomId:`, data.roomId);
        throw new Error(`Invalid roomId: ${data.roomId}`);
      }
      
      const channel = `room:${normalizedRoomId}`;
      
      // FAN-OUT TRIGGER: Publish to Redis (all Gateway pods will receive this)
      await redisPublisher.publish(channel, JSON.stringify({
        type: 'message.reply.created',
        ...data,
        roomId: normalizedRoomId, // Ensure normalized roomId in payload
      }));
      
      console.log(`📤 [Kafka→Redis] Published message.reply.created to channel ${channel} (fan-out trigger)`);
      
      // Note: In the old pattern with shared consumer, ack is handled in index.ts
      // This method is kept for compatibility but won't be called in the old pattern
    } catch (error) {
      console.error(`❌ [MessageReplyCreatedListener] Error processing message:`, error);
      throw error; // Re-throw so base class can handle retry logic if needed
    }
  }
}

