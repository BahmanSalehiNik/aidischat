// src/events/listeners/ai-message-reply-listener.ts
import { Listener } from '@aichatwar/shared';
import { AiMessageReplyEvent } from '@aichatwar/shared';
import { Subjects } from '@aichatwar/shared';
import { Message } from '../../models/message';
import { RoomParticipant } from '../../models/room-participant';
import { Agent } from '../../models/agent';
import { AiReplyCount } from '../../models/ai-reply-count';
import { MessageCreatedPublisher } from '../publishers/message-created-publisher';
import { kafkaWrapper } from '../../kafka-client';
import { AI_MAX_REPLIES_PER_MESSAGE } from '../../constants';
import crypto from 'crypto';

export class AiMessageReplyListener extends Listener<AiMessageReplyEvent> {
  readonly topic = Subjects.AiMessageReply;
  readonly groupId = 'chat-service-ai-message-reply';

  async onMessage(data: AiMessageReplyEvent['data'], payload: any) {
    const { originalMessageId, roomId, agentId, ownerUserId, content, tempId } = data;

    // Validate: Check if agent is a participant in the room
    const participant = await RoomParticipant.findOne({ 
      roomId, 
      participantId: agentId,
      participantType: 'agent',
      leftAt: { $exists: false }
    });

    if (!participant) {
      console.log(`AI message reply rejected: Agent ${agentId} is not a participant in room ${roomId}`);
      await this.ack(); // Acknowledge to prevent redelivery of invalid messages
      return;
    }

    // Generate message ID
    const messageId = crypto.randomUUID();
    
    // Use tempId as dedupeKey if provided, otherwise generate one
    const dedupeKey = tempId || `${roomId}-${agentId}-${Date.now()}`;

    // Fetch agent name for denormalization
    const agent = await Agent.findOne({ _id: agentId }).lean();
    const senderName = agent?.name;

    // Create and save message to database (senderType is 'agent')
    const message = Message.build({
      id: messageId,
      roomId,
      senderType: 'agent',
      senderId: agentId,
      senderName, // Store denormalized sender name
      content,
      attachments: [],
      dedupeKey
    });

    await message.save();

    // Verify message was saved
    const savedMessage = await Message.findOne({ _id: messageId }).lean();
    if (!savedMessage) {
      console.error(`❌ [AI Message Reply] Failed to save message ${messageId} - message not found after save!`);
    } else {
      console.log(`✅ [AI Message Reply] Message ${messageId} confirmed saved in database:`, {
        roomId: savedMessage.roomId,
        senderType: savedMessage.senderType,
        senderId: savedMessage.senderId,
        senderName: savedMessage.senderName,
        contentLength: savedMessage.content?.length || 0,
        createdAt: savedMessage.createdAt,
      });
    }

    // Increment reply count for this agent's reply to the original message
    const replyCount = await AiReplyCount.incrementReplyCount(originalMessageId, agentId);
    console.log(`[AI Message Reply] Reply count for original message ${originalMessageId}: ${replyCount.replyCount}/${AI_MAX_REPLIES_PER_MESSAGE}`);

    // Publish message created event (for other services like realtime-gateway)
    await new MessageCreatedPublisher(kafkaWrapper.producer).publish({
      id: message.id,
      roomId: message.roomId,
      senderType: message.senderType,
      senderId: message.senderId,
      senderName: message.senderName, // Include sender name in event
      content: message.content,
      attachments: message.attachments,
      createdAt: message.createdAt.toISOString(),
      dedupeKey: message.dedupeKey,
    });

    await this.ack();
  }
}

