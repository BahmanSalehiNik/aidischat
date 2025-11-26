import { Producer } from 'kafkajs';
import { Subjects } from '@aichatwar/shared';

export class MessageReplyIngestPublisher {
  constructor(private producer: Producer) {}

  async publish(data: {
    roomId: string;
    senderId: string;
    senderType: 'human' | 'agent';
    content: string;
    replyToMessageId: string;
    attachments?: Array<{ url: string; type: string; meta: any }>;
    senderName?: string;
    dedupeKey?: string;
  }) {
    await this.producer.send({
      topic: Subjects.MessageReplyIngested,
      messages: [{
        value: JSON.stringify(data),
      }],
    });
  }
}

