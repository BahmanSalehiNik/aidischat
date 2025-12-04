import { redisPublisher } from '../../redis';
import { EachMessagePayload } from 'kafkajs';
import { Listener, MessageCreatedEvent, Subjects } from '@aichatwar/shared';

/**
 * MessageCreatedListener
 * 
 * FAN-OUT ARCHITECTURE:
 * This listener runs on ONE Gateway pod (thanks to Kafka consumer group).
 * It receives message.created events from Kafka and triggers Redis pub/sub fan-out.
 * 
 * Flow:
 * 1. Kafka delivers message.created to exactly ONE pod (consumer group guarantees this)
 * 2. This pod publishes to Redis channel "room:{roomId}" 
 * 3. Redis broadcasts to ALL Gateway pods subscribed to that channel
 * 4. Each pod checks local roomMembers map and sends to its connected sockets
 * 
 * Note: All listeners use the same groupId 'realtime-gateway-group' to ensure
 * only one pod processes each message, then fans out via Redis.
 */
export class MessageCreatedListener extends Listener<MessageCreatedEvent> {
  readonly topic = Subjects.MessageCreated;
  readonly groupId = 'realtime-gateway-group';
  protected fromBeginning: boolean = false; // Read from latest offset (only new messages)

  async onMessage(data: MessageCreatedEvent['data'], kafkaPayload: EachMessagePayload) {
    console.log(`📥 [MessageCreatedListener] onMessage called with data:`, {
      messageId: data.id,
      roomId: data.roomId,
      senderId: data.senderId,
      senderName: data.senderName,
      contentLength: data.content?.length || 0,
      partition: kafkaPayload.partition,
      offset: kafkaPayload.message.offset,
    });
    
    // Validate required fields before publishing
    // Note: content can be empty (e.g., messages with only attachments)
    if (!data.id || !data.roomId || !data.senderId) {
      console.warn(`⚠️ [MessageCreatedListener] Invalid message.created event, missing required fields:`, {
        hasId: !!data.id,
        hasRoomId: !!data.roomId,
        hasSenderId: !!data.senderId,
        hasContent: !!data.content,
      });
      return;
    }
    
    // Normalize roomId to ensure consistency (trim whitespace)
    const normalizedRoomId = data.roomId?.trim();
    if (!normalizedRoomId) {
      console.error(`❌ [MessageCreatedListener] Invalid roomId in message.created event:`, data.roomId);
      // Note: In the old pattern with shared consumer, ack is handled in index.ts
      // throw error to prevent ack in index.ts
      throw new Error(`Invalid roomId: ${data.roomId}`);
    }
    
    const channel = `room:${normalizedRoomId}`;
    const redisPayload = {
      ...data,
      roomId: normalizedRoomId, // Ensure roomId in payload is also normalized
    };
    
    // FAN-OUT TRIGGER: Publish to Redis (all Gateway pods will receive this)
    const publishResult = await redisPublisher.publish(channel, JSON.stringify(redisPayload));
    
    console.log(`📤 [Kafka→Redis] Published message.created to channel "${channel}" (roomId: "${normalizedRoomId}") (fan-out trigger)`, {
      channel,
      roomId: normalizedRoomId,
      messageId: data.id,
      publishResult, // Number of subscribers that received the message
      payloadSize: JSON.stringify(redisPayload).length,
    });
    
    // Note: In the old pattern with shared consumer, ack is handled in index.ts
    // This method is kept for compatibility but won't be called in the old pattern
    // await this.ack(kafkaPayload);
  }
}

