import { redisPublisher } from '../../redis';
import { Consumer, EachMessagePayload } from 'kafkajs';
import { Listener, MessageReplyCreatedEvent, Subjects } from '@aichatwar/shared';

/**
 * MessageReplyCreatedListener
 * 
 * FAN-OUT ARCHITECTURE:
 * This listener runs on ONE Gateway pod (thanks to Kafka consumer group).
 * It receives message.reply.created events from Kafka and triggers Redis pub/sub fan-out.
 * 
 * Note: This listener extends the base Listener but uses a shared consumer pattern.
 * The listen() method is overridden to be a no-op since subscription/run is handled centrally in index.ts
 */
export class MessageReplyCreatedListener extends Listener<MessageReplyCreatedEvent> {
  readonly topic = Subjects.MessageReplyCreated;
  readonly groupId = 'realtime-gateway-group';

  constructor(consumer: Consumer) {
    super(consumer);
  }

  // Override listen() to be a no-op since we use shared consumer in index.ts
  async listen() {
    // No-op: subscription and run are handled centrally in index.ts
    console.log(`✅ [MessageReplyCreatedListener] Listener initialized for topic: ${this.topic}`);
  }

  async onMessage(data: MessageReplyCreatedEvent['data'], payload: EachMessagePayload) {
    try {
      console.log(`📥 [MessageReplyCreatedListener] Received reply.created event:`, {
        messageId: data.messageId,
        roomId: data.roomId,
        replyToMessageId: data.replyToMessageId,
      });
      
      const channel = `room:${data.roomId}`;
      
      // FAN-OUT TRIGGER: Publish to Redis (all Gateway pods will receive this)
      await redisPublisher.publish(channel, JSON.stringify({
        type: 'message.reply.created',
        ...data
      }));
      
      console.log(`📤 [Kafka→Redis] Published message.reply.created to channel ${channel} (fan-out trigger)`);
    } catch (error) {
      console.error(`❌ [MessageReplyCreatedListener] Error processing message:`, error);
    }
  }
}

