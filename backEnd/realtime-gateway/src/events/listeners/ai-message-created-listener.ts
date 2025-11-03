import { redisPublisher } from '../../redis';
import { Consumer } from 'kafkajs';

export class AiMessageCreatedListener {
  constructor(private consumer: Consumer) {}

  async listen() {
    await this.consumer.subscribe({ topic: 'message.created' });
    await this.consumer.run({
      eachMessage: async ({ message }: { message: { value: Buffer | null } }) => {
        const data = JSON.parse(message.value!.toString());
        // Only handle AI/agent messages
        if (data.senderType === 'agent') {
          await redisPublisher.publish(`room:${data.roomId}`, JSON.stringify(data));
        }
      },
    });
  }
}

