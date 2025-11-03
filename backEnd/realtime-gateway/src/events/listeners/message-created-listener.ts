import { redisPublisher } from '../../redis';
import { Consumer } from 'kafkajs';

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
 */
export class MessageCreatedListener {
  constructor(private consumer: Consumer) {}

  async listen() {
    await this.consumer.subscribe({ topic: 'message.created' });
    await this.consumer.run({
      eachMessage: async ({ message }: { message: { value: Buffer | null } }) => {
        const data = JSON.parse(message.value!.toString());
        const channel = `room:${data.roomId}`;
        
        // FAN-OUT TRIGGER: Publish to Redis (all Gateway pods will receive this)
        await redisPublisher.publish(channel, JSON.stringify(data));
        
        console.log(`📤 [Kafka→Redis] Published message.created to channel ${channel} (fan-out trigger)`);
      },
    });
  }
}

