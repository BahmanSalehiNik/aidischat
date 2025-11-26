import { Producer } from 'kafkajs';

export class MessageIngestPublisher {
  constructor(private producer: Producer) {}

  async publish(data: {
    roomId: string;
    content: string;
    senderId: string;
    senderType: string;
    tempId?: string;
    replyToMessageId?: string | null;
  }) {
    await this.producer.send({
      topic: 'message.ingest',
      messages: [{ key: data.roomId, value: JSON.stringify(data) }],
    });
  }
}

