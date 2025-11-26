import { redisPublisher } from '../../redis';
import { Consumer, EachMessagePayload } from 'kafkajs';
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
 * Note: This listener extends the base Listener but uses a shared consumer pattern.
 * The listen() method is overridden to be a no-op since subscription/run is handled centrally in index.ts
 */
export class MessageCreatedListener extends Listener<MessageCreatedEvent> {
  readonly topic = Subjects.MessageCreated;
  readonly groupId = 'realtime-gateway-group';

  constructor(consumer: Consumer) {
    super(consumer);
  }

  // Override listen() to be a no-op since we use shared consumer in index.ts
  async listen() {
    // No-op: subscription and run are handled centrally in index.ts
    console.log(`✅ [MessageCreatedListener] Listener initialized for topic: ${this.topic}`);
  }

  async onMessage(data: MessageCreatedEvent['data'], payload: EachMessagePayload) {
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
    
    const channel = `room:${data.roomId}`;
    
    // FAN-OUT TRIGGER: Publish to Redis (all Gateway pods will receive this)
    await redisPublisher.publish(channel, JSON.stringify(data));
    
    console.log(`📤 [Kafka→Redis] Published message.created to channel ${channel} (fan-out trigger)`);
  }
}

