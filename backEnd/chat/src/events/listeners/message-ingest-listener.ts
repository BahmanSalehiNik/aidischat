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

    // Create and save message to database
    const message = Message.build({
      id: messageId,
      roomId,
      senderType: senderType as 'human' | 'agent',
      senderId,
      senderName, // Store denormalized sender name
      content,
      attachments: [],
      dedupeKey
    });

    await message.save();

    console.log(`Message ingested and saved in chat service: ${messageId} for room ${roomId}`);

    // Publish message created event (for other services like realtime-gateway)
    await new MessageCreatedPublisher(kafkaWrapper.producer).publish({
      id: message.id,
      roomId: message.roomId,
      senderType: message.senderType,
      senderId: message.senderId,
      senderName: message.senderName, // Include sender name in event (denormalized)
      content: message.content,
      attachments: message.attachments,
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

        // Get agent information to get ownerUserId (using createdBy field which should be ownerUserId)
        const agents = await Agent.find({
          _id: { $in: participantAgentIds },
          isActive: true
        });

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

