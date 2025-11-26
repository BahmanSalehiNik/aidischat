// src/events/listeners/message-ingest-listener.ts
import { Listener } from '@aichatwar/shared';
import { MessageIngestEvent } from '@aichatwar/shared';
import { Subjects } from '@aichatwar/shared';
import { Message } from '../../models/message';
import { RoomParticipant } from '../../models/room-participant';
import { Agent } from '../../models/agent';
import { User } from '../../models/user';
import { AiReplyCount } from '../../models/ai-reply-count';
import { MessageCreatedPublisher } from '../publishers/message-created-publisher';
import { AiMessageCreatedPublisher } from '../publishers/ai-message-created-publisher';
import { kafkaWrapper } from '../../kafka-client';
import { AI_MAX_REPLIES_PER_MESSAGE } from '../../constants';
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

    // Fetch sender name for denormalization (store in message for quick access)
    let senderName: string | undefined;
    if (senderType === 'human') {
      const user = await User.findOne({ _id: senderId }).lean();
      if (user) {
        // Use displayName -> username -> email prefix as fallback
        senderName = user.displayName || user.username || user.email?.split('@')[0];
      }
    } else if (senderType === 'agent') {
      const agent = await Agent.findOne({ _id: senderId }).lean();
      if (agent) {
        senderName = agent.name;
      }
    }

    // Check if this is a reply (replyToMessageId in data)
    const replyToMessageId = (data as any).replyToMessageId || null;
    let originalMessage = null;
    
    // If it's a reply, validate the original message exists and fetch it
    if (replyToMessageId) {
      originalMessage = await Message.findOne({ _id: replyToMessageId, roomId }).lean();
      if (!originalMessage) {
        console.log(`[Message Ingest] Rejected: Original message ${replyToMessageId} not found in room ${roomId}`);
        await this.ack();
        return;
      }
    }

    // Create and save message to database
    const message = Message.build({
      id: messageId,
      roomId,
      senderType: senderType as 'human' | 'agent',
      senderId,
      senderName, // Store denormalized sender name
      content,
      attachments: [],
      replyToMessageId: replyToMessageId || null, // Set reply reference if provided
      reactions: [], // Initialize empty reactions array
      dedupeKey
    });

    await message.save();

    // Verify message was saved
    const savedMessage = await Message.findOne({ _id: messageId }).lean();
    if (!savedMessage) {
      console.error(`❌ [Message Ingest] Failed to save message ${messageId} - message not found after save!`);
    } else {
      console.log(`✅ [Message Ingest] Message ${messageId} confirmed saved in database:`, {
        roomId: savedMessage.roomId,
        senderType: savedMessage.senderType,
        senderId: savedMessage.senderId,
        senderName: savedMessage.senderName,
        contentLength: savedMessage.content?.length || 0,
        createdAt: savedMessage.createdAt,
      });
    }

    // Publish message created event (for other services like realtime-gateway)
    await new MessageCreatedPublisher(kafkaWrapper.producer).publish({
      id: message.id,
      roomId: message.roomId,
      senderType: message.senderType,
      senderId: message.senderId,
      senderName: message.senderName, // Include sender name in event (denormalized)
      content: message.content,
      attachments: message.attachments,
      replyToMessageId: message.replyToMessageId || null, // Include reply reference
      // Include replyTo data directly in message.created if this is a reply
      replyTo: originalMessage ? {
        id: originalMessage._id?.toString() || originalMessage.id,
        senderId: originalMessage.senderId,
        senderName: originalMessage.senderName || undefined,
        senderType: originalMessage.senderType,
        content: originalMessage.content,
        // Exclude attachments - not needed for preview card, user can jump to message to see full content
        createdAt: originalMessage.createdAt?.toISOString() || new Date().toISOString(),
      } : undefined,
      reactions: message.reactions.map((r: any) => ({
        userId: r.userId,
        emoji: r.emoji,
        createdAt: r.createdAt.toISOString(),
      })),
      createdAt: message.createdAt.toISOString(),
      dedupeKey: message.dedupeKey,
    });

    // If sender is not an AI agent, publish ai.message.created with AI receivers
    if (senderType !== 'agent') {
      // Get all AI agents in the room (participants with participantType='agent')
      const aiParticipants = await RoomParticipant.find({
        roomId,
        participantType: 'agent',
        leftAt: { $exists: false }
      });

      if (aiParticipants.length > 0) {
        // Get agentIds from participants
        const participantAgentIds = aiParticipants.map(p => p.participantId);
        console.log(`[MessageIngest] Found ${aiParticipants.length} agent participants in room ${roomId}: ${participantAgentIds.join(', ')}`);

        // Get agent information to get ownerUserId (using createdBy field which should be ownerUserId)
        const agents = await Agent.find({
          _id: { $in: participantAgentIds },
          isActive: true
        });
        console.log(`[MessageIngest] Found ${agents.length} active agents in chat service (out of ${participantAgentIds.length} participants)`);
        
        if (agents.length === 0 && participantAgentIds.length > 0) {
          // Check if agents exist but are not active
          const allAgents = await Agent.find({ _id: { $in: participantAgentIds } });
          console.log(`[MessageIngest] Total agents found (including inactive): ${allAgents.length}`);
          allAgents.forEach(a => {
            console.log(`[MessageIngest] Agent ${a.id}: isActive=${a.isActive}, name=${a.name}`);
          });
        }

        // Check reply counts for all agents in a single query and filter out those that have reached the limit
        const agentIds = agents.map(a => a.id);
        const replyCounts = await AiReplyCount.find({
          originalMessageId: message.id,
          agentId: { $in: agentIds }
        });

        // Create a map of agentId -> replyCount for quick lookup
        const replyCountMap = new Map<string, number>();
        replyCounts.forEach(rc => {
          replyCountMap.set(rc.agentId, rc.replyCount);
        });

        // Filter agents that haven't reached the reply limit
        const eligibleAgents = agents.filter(agent => {
          const replyCount = replyCountMap.get(agent.id) || 0;
          if (replyCount >= AI_MAX_REPLIES_PER_MESSAGE) {
            console.log(`Agent ${agent.id} excluded from ai.message.created - reached max replies (${replyCount}/${AI_MAX_REPLIES_PER_MESSAGE}) for message ${message.id}`);
            return false;
          }
          return true;
        });

        // Build aiReceivers array with agentId and ownerUserId (only for eligible agents)
        const aiReceivers = eligibleAgents.map(agent => ({
          agentId: agent.id,
          ownerUserId: agent.createdBy // createdBy should be ownerUserId based on agent-updated-listener
        }));

        // Only publish if there are AI receivers
        if (aiReceivers.length > 0) {
          await new AiMessageCreatedPublisher(kafkaWrapper.producer).publish({
            messageId: message.id,
            roomId: message.roomId,
            senderId: message.senderId,
            senderType: message.senderType,
            content: message.content,
            attachments: message.attachments,
            createdAt: message.createdAt.toISOString(),
            dedupeKey: message.dedupeKey,
            aiReceivers,
          });

          console.log(`Published ai.message.created for message ${messageId} with ${aiReceivers.length} AI receivers (${agents.length - eligibleAgents.length} excluded due to reply limit)`);
        } else {
          console.log(`No eligible AI receivers for message ${messageId} - all agents have reached reply limit`);
        }
      }
    } else {
      console.log(`Skipping ai.message.created for message ${messageId} - sender is an AI agent (preventing loop)`);
    }

    await this.ack();
  }
}

