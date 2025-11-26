// src/events/listeners/message-reply-ingested-listener.ts
import { Listener, Subjects, MessageReplyIngestedEvent } from '@aichatwar/shared';
import { Message } from '../../models/message';
import { RoomParticipant } from '../../models/room-participant';
import { User } from '../../models/user';
import { Agent } from '../../models/agent';
import { MessageCreatedPublisher } from '../publishers/message-created-publisher';
import { MessageReplyCreatedPublisher } from '../publishers/message-reply-publishers';
import { kafkaWrapper } from '../../kafka-client';
import { EachMessagePayload } from 'kafkajs';
import crypto from 'crypto';

export class MessageReplyIngestedListener extends Listener<MessageReplyIngestedEvent> {
  readonly topic = Subjects.MessageReplyIngested;
  readonly groupId = 'chat-service-message-reply-ingested';

  async onMessage(data: MessageReplyIngestedEvent['data'], payload: EachMessagePayload) {
    const { roomId, senderId, senderType, content, replyToMessageId, attachments, senderName, dedupeKey } = data;

    console.log(`[Message Reply Ingested] Processing reply to message ${replyToMessageId} in room ${roomId}`);

    // Validate: Check if sender is a participant in the room
    const participant = await RoomParticipant.findOne({
      roomId,
      participantId: senderId,
      leftAt: { $exists: false }
    });

    if (!participant) {
      console.log(`[Message Reply Ingested] Rejected: User ${senderId} is not a participant in room ${roomId}`);
      await this.ack();
      return;
    }

    // Validate: Check if the message being replied to exists and is in the same room
    const originalMessage = await Message.findOne({ _id: replyToMessageId, roomId });
    if (!originalMessage) {
      console.log(`[Message Reply Ingested] Rejected: Original message ${replyToMessageId} not found in room ${roomId}`);
      await this.ack();
      return;
    }

    // Generate message ID
    const messageId = crypto.randomUUID();
    
    // Use provided dedupeKey or generate one
    const finalDedupeKey = dedupeKey || `${roomId}-${senderId}-${Date.now()}`;

    // Fetch sender name if not provided
    let finalSenderName: string | undefined = senderName;
    if (!finalSenderName) {
      if (senderType === 'human') {
        const user = await User.findOne({ _id: senderId }).lean();
        if (user) {
          finalSenderName = user.displayName || user.username || user.email?.split('@')[0];
        }
      } else if (senderType === 'agent') {
        const agent = await Agent.findOne({ _id: senderId }).lean();
        if (agent) {
          finalSenderName = agent.name;
        }
      }
    }

    // Create and save reply message
    const replyMessage = Message.build({
      id: messageId,
      roomId,
      senderType: senderType as 'human' | 'agent',
      senderId,
      senderName: finalSenderName,
      content,
      attachments: attachments || [],
      replyToMessageId, // Set the reply reference
      reactions: [], // Initialize empty reactions array
      dedupeKey: finalDedupeKey,
    });

    await replyMessage.save();

    console.log(`[Message Reply Ingested] Created reply message ${messageId} to ${replyToMessageId}`);

    // Publish message created event (normal message event with replyToMessageId and replyTo data)
    await new MessageCreatedPublisher(kafkaWrapper.producer).publish({
      id: replyMessage.id,
      roomId: replyMessage.roomId,
      senderType: replyMessage.senderType,
      senderId: replyMessage.senderId,
      senderName: replyMessage.senderName,
      content: replyMessage.content,
      attachments: replyMessage.attachments,
      replyToMessageId: replyMessage.replyToMessageId || null,
      replyTo: {
        id: originalMessage.id,
        senderId: originalMessage.senderId,
        senderName: originalMessage.senderName || undefined,
        senderType: originalMessage.senderType,
        content: originalMessage.content,
        // Exclude attachments - not needed for preview card, user can jump to message to see full content
        createdAt: originalMessage.createdAt.toISOString(),
      },
      reactions: replyMessage.reactions.map((r: any) => ({
        userId: r.userId,
        emoji: r.emoji,
        createdAt: r.createdAt.toISOString(),
      })),
      createdAt: replyMessage.createdAt.toISOString(),
      dedupeKey: replyMessage.dedupeKey,
    });

    // Publish reply created event (with original message context)
    await new MessageReplyCreatedPublisher(kafkaWrapper.producer).publish({
      roomId,
      messageId: replyMessage.id,
      replyToMessageId: originalMessage.id,
      replyTo: {
        id: originalMessage.id,
        senderId: originalMessage.senderId,
        senderName: originalMessage.senderName || undefined, // Ensure senderName is included
        senderType: originalMessage.senderType,
        content: originalMessage.content,
        // Exclude attachments - not needed for preview card
        createdAt: originalMessage.createdAt.toISOString(),
      },
    });

    console.log(`[Message Reply Ingested] Published reply events for message ${messageId}`);

    await this.ack();
  }
}

