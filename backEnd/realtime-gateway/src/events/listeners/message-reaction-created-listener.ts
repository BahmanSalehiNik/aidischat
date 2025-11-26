import { redisPublisher } from '../../redis';
import { Consumer, EachMessagePayload } from 'kafkajs';
import { Listener, MessageReactionCreatedEvent, Subjects } from '@aichatwar/shared';

/**
 * MessageReactionCreatedListener
 * 
 * FAN-OUT ARCHITECTURE:
 * This listener runs on ONE Gateway pod (thanks to Kafka consumer group).
 * It receives message.reaction.created events from Kafka and triggers Redis pub/sub fan-out.
 * 
 * Note: This listener extends the base Listener but uses a shared consumer pattern.
 * The listen() method is overridden to be a no-op since subscription/run is handled centrally in index.ts
 */
export class MessageReactionCreatedListener extends Listener<MessageReactionCreatedEvent> {
  readonly topic = Subjects.MessageReactionCreated;
  readonly groupId = 'realtime-gateway-group';

  constructor(consumer: Consumer) {
    super(consumer);
  }

  // Override listen() to be a no-op since we use shared consumer in index.ts
  async listen() {
    // No-op: subscription and run are handled centrally in index.ts
    console.log(`✅ [MessageReactionCreatedListener] Listener initialized for topic: ${this.topic}`);
  }

  async onMessage(data: MessageReactionCreatedEvent['data'], kafkaPayload: EachMessagePayload) {
    try {
      console.log(`📥 [MessageReactionCreatedListener] Received reaction.created event:`, {
        messageId: data.messageId,
        roomId: data.roomId,
        emoji: data.reaction?.emoji,
        userId: data.reaction?.userId,
        reactionsSummary: data.reactionsSummary,
      });
      
      const channel = `room:${data.roomId}`;
      
      // FAN-OUT TRIGGER: Publish to Redis (all Gateway pods will receive this)
      const redisPayload = {
        type: 'message.reaction.created',
        messageId: data.messageId,
        roomId: data.roomId,
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
    } catch (error) {
      console.error(`❌ [MessageReactionCreatedListener] Error processing message:`, error);
      throw error; // Re-throw so base class can handle retry logic if needed
    }
  }
}

