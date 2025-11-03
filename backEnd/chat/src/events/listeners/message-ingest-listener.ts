// src/events/listeners/message-ingest-listener.ts
import { Listener } from '@aichatwar/shared';
import { MessageIngestEvent } from '@aichatwar/shared';
import { Subjects } from '@aichatwar/shared';
import { Message } from '../../models/message';
import { RoomParticipant } from '../../models/room-participant';
import { MessageCreatedPublisher } from '../publishers/message-created-publisher';
import { kafkaWrapper } from '../../kafka-client';
import crypto from 'crypto';

export class MessageIngestListener extends Listener<MessageIngestEvent> {
  readonly topic = Subjects.MessageIngest;
  readonly groupId = 'chat-service-message-ingest';

  async onMessage(data: MessageIngestEvent['data'], payload: any) {
    const { roomId, content, senderId, senderType, tempId } = data;

    // Validate: Check if sender is a participant in the room
    const participant = await RoomParticipant.findOne({ 
      roomId, 
      participantId: senderId,
      leftAt: { $exists: false }
    });

    if (!participant) {
      console.log(`Message ingest rejected: User ${senderId} is not a participant in room ${roomId}`);
      await this.ack(); // Acknowledge to prevent redelivery of invalid messages
      return;
    }

    // Generate message ID
    const messageId = crypto.randomUUID();
    
    // Use tempId as dedupeKey if provided, otherwise generate one
    const dedupeKey = tempId || `${roomId}-${senderId}-${Date.now()}`;

    // Create and save message to database
    const message = Message.build({
      id: messageId,
      roomId,
      senderType: senderType as 'human' | 'agent',
      senderId,
      content,
      attachments: [],
      dedupeKey
    });

    await message.save();

    console.log(`Message ingested and saved in chat service: ${messageId} for room ${roomId}`);

    // Publish message created event
    await new MessageCreatedPublisher(kafkaWrapper.producer).publish({
      id: message.id,
      roomId: message.roomId,
      senderType: message.senderType,
      senderId: message.senderId,
      content: message.content,
      attachments: message.attachments,
      createdAt: message.createdAt.toISOString(),
      dedupeKey: message.dedupeKey,
    });

    await this.ack();
  }
}

