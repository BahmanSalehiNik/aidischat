import { Producer } from 'kafkajs';
import { Subjects } from '@aichatwar/shared';

export class MessageReactionIngestPublisher {
  constructor(private producer: Producer) {}

  async publish(data: {
    roomId: string;
    messageId: string;
    userId: string;
    emoji: string;
    action?: 'add' | 'remove';
  }) {
    await this.producer.send({
      topic: Subjects.MessageReactionIngested,
      messages: [{
        value: JSON.stringify(data),
      }],
    });
  }
}

