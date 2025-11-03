import { redisPublisher } from '../../redis';
import { Consumer } from 'kafkajs';

export class RoomUpdatedListener {
  constructor(private consumer: Consumer) {}

  async listen() {
    await this.consumer.subscribe({ topic: 'room.updated' });
    await this.consumer.run({
      eachMessage: async ({ message }: { message: { value: Buffer | null } }) => {
        const data = JSON.parse(message.value!.toString());
        await redisPublisher.publish(`room:${data.id}`, JSON.stringify(data));
      },
    });
  }
}

