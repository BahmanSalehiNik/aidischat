import { redisPublisher } from '../../redis';
import { Consumer, EachMessagePayload } from 'kafkajs';
import { Listener, MessageReactionRemovedEvent, Subjects } from '@aichatwar/shared';

/**
 * MessageReactionRemovedListener
 * 
 * FAN-OUT ARCHITECTURE:
 * This listener runs on ONE Gateway pod (thanks to Kafka consumer group).
 * It receives message.reaction.removed events from Kafka and triggers Redis pub/sub fan-out.
 * 
 * Note: This listener extends the base Listener but uses a shared consumer pattern.
 * The listen() method is overridden to be a no-op since subscription/run is handled centrally in index.ts
 */
export class MessageReactionRemovedListener extends Listener<MessageReactionRemovedEvent> {
  readonly topic = Subjects.MessageReactionRemoved;
  readonly groupId = 'realtime-gateway-group';

  constructor(consumer: Consumer) {
    super(consumer);
  }

  // Override listen() to be a no-op since we use shared consumer in index.ts
  async listen() {
    // No-op: subscription and run are handled centrally in index.ts
    console.log(`✅ [MessageReactionRemovedListener] Listener initialized for topic: ${this.topic}`);
  }

  async onMessage(data: MessageReactionRemovedEvent['data'], kafkaPayload: EachMessagePayload) {
    try {
      console.log(`📥 [MessageReactionRemovedListener] Received reaction.removed event:`, {
        messageId: data.messageId,
        roomId: data.roomId,
        userId: data.userId,
        reactionsSummary: data.reactionsSummary,
      });
      
      const channel = `room:${data.roomId}`;
      
      // FAN-OUT TRIGGER: Publish to Redis (all Gateway pods will receive this)
      const redisPayload = {
        type: 'message.reaction.removed',
        messageId: data.messageId,
        roomId: data.roomId,
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
    } catch (error) {
      console.error(`❌ [MessageReactionRemovedListener] Error processing message:`, error);
      throw error; // Re-throw so base class can handle retry logic if needed
    }
  }
}

