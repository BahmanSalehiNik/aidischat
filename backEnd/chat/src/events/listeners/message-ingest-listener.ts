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
      let user = await User.findOne({ _id: senderId }).lean();
      if (user) {
        // Use displayName -> username -> email prefix as fallback
        senderName = user.displayName || user.username || user.email?.split('@')[0];
        console.log(`[Message Ingest] User lookup successful: senderId=${senderId}, senderName=${senderName}, displayName=${user.displayName}, username=${user.username}, email=${user.email}`);
      } else {
        // User doesn't exist in chat service DB - this can happen if UserCreated event was missed
        // Try to create a minimal user record (will be updated when UserCreated/UserUpdated events arrive)
        // For now, use a fallback name based on senderId
        console.warn(`[Message Ingest] ⚠️ User not found in chat service DB: senderId=${senderId} - creating minimal user record and using fallback name`);
        
        // Create minimal user (will be updated by UserCreated/UserUpdated events)
        try {
          console.log(`[Message Ingest] Created minimal user record for ${senderId}`);
          
          // Use a readable fallback name (first 8 chars of ID)
          senderName = `User ${senderId.slice(0, 8)}`;
        } catch (error: any) {
          // User might have been created by another process, try to fetch again
          user = await User.findOne({ _id: senderId }).lean();
          if (user) {
            senderName = user.displayName || user.username || user.email?.split('@')[0] || `User ${senderId.slice(0, 8)}`;
          } else {
            // Still not found, use fallback
            senderName = `User ${senderId.slice(0, 8)}`;
          }
        }
      }
    } else if (senderType === 'agent') {
      const agent = await Agent.findOne({ _id: senderId }).lean();
      if (agent) {
        senderName = agent.name;
        console.log(`[Message Ingest] Agent lookup successful: senderId=${senderId}, senderName=${senderName}`);
      } else {
        console.warn(`[Message Ingest] ⚠️ Agent not found in chat service DB: senderId=${senderId} - senderName will be undefined`);
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
    const messageCreatedEvent = {
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
    };
    
    console.log(`📤 [Chat Service] Publishing message.created event to Kafka:`, {
      messageId: messageCreatedEvent.id,
      roomId: messageCreatedEvent.roomId,
      senderId: messageCreatedEvent.senderId,
      senderName: messageCreatedEvent.senderName,
      contentLength: messageCreatedEvent.content?.length || 0,
      hasReplyTo: !!messageCreatedEvent.replyTo,
    });
    
    await new MessageCreatedPublisher(kafkaWrapper.producer).publish(messageCreatedEvent);
    
    console.log(`✅ [Chat Service] Successfully published message.created event to Kafka for message ${messageCreatedEvent.id}`);

    // Publish ai.message.created with AI receivers
    // - If sender is human: send to all agents in the room
    // - If sender is agent: send to all agents EXCEPT the sender itself (to prevent self-replies)
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
      // IMPORTANT: We include ALL agents in the room, not just active ones, because:
      // 1. Agents need to see each other's messages for context
      // 2. An agent might be temporarily inactive but still in the room
      // 3. The AI Gateway will handle inactive agents appropriately
      const agents = await Agent.find({
        _id: { $in: participantAgentIds }
      });
      console.log(`[MessageIngest] Found ${agents.length} agents in chat service (out of ${participantAgentIds.length} participants)`);
      
      // Log agent status for debugging
      if (agents.length < participantAgentIds.length) {
        const foundAgentIds = new Set(agents.map(a => a.id));
        const missingAgentIds = participantAgentIds.filter(id => !foundAgentIds.has(id));
        console.warn(`[MessageIngest] ⚠️ Some agents in room are not in chat service DB: ${missingAgentIds.join(', ')}`);
        console.warn(`[MessageIngest] These agents will NOT receive messages. Ensure AgentCreated/AgentIngested events are processed.`);
      }
      
      agents.forEach(a => {
        if (!a.isActive) {
          console.log(`[MessageIngest] Agent ${a.id} (${a.name}) is not active but will still receive messages for context`);
        }
      });

      // IMPORTANT: Agents need to see each other's messages for context (they're added to the thread),
      // but they should NOT generate replies to agent messages to prevent infinite loops
      // We'll publish ai.message.created for agent messages so they're added to the thread,
      // but the AI Gateway will check senderType and skip reply generation for agent messages
      
      // If sender is an agent, filter out the sender from the receivers (agents shouldn't reply to themselves)
      // If sender is human, all agents in the room should receive the message
      let eligibleAgentsForReceiving = agents;
      if (senderType === 'agent') {
        eligibleAgentsForReceiving = agents.filter(agent => agent.id !== senderId);
        console.log(`[MessageIngest] Sender is an agent (${senderId}), filtering out sender from receivers. ${eligibleAgentsForReceiving.length} agents will receive the message for context (out of ${agents.length} total). AI Gateway will skip reply generation for agent messages.`);
      }

      if (eligibleAgentsForReceiving.length === 0) {
        console.log(`[MessageIngest] No eligible agents to receive message ${messageId} (all filtered out)`);
        await this.ack();
        return;
      }

      // Check reply counts for all agents in a single query and filter out those that have reached the limit
      const agentIds = eligibleAgentsForReceiving.map(a => a.id);
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
      const eligibleAgents = eligibleAgentsForReceiving.filter(agent => {
        const replyCount = replyCountMap.get(agent.id) || 0;
        if (replyCount >= AI_MAX_REPLIES_PER_MESSAGE) {
          console.log(`Agent ${agent.id} excluded from ai.message.created - reached max replies (${replyCount}/${AI_MAX_REPLIES_PER_MESSAGE}) for message ${message.id}`);
          return false;
        }
        return true;
      });

      // Build aiReceivers array with agentId and ownerUserId (only for eligible agents)
      // IMPORTANT: Filter out the sender agent if sender is an agent (shouldn't happen since we skip agent messages above,
      // but adding as a safety check for edge cases)
      const aiReceivers = eligibleAgents
        //.filter(agent => agent.id !== senderId) // Exclude sender agent from receivers
        .map(agent => ({
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
          senderName: message.senderName, // Include sender name for message formatting
          content: message.content,
          attachments: message.attachments,
          createdAt: message.createdAt.toISOString(),
          dedupeKey: message.dedupeKey,
          aiReceivers,
        });

        const excludedCount = agents.length - eligibleAgents.length;
        const exclusionReason = senderType === 'agent' 
          ? `(sender excluded: 1, reply limit: ${excludedCount - 1})`
          : `(reply limit: ${excludedCount})`;
        console.log(`Published ai.message.created for message ${messageId} with ${aiReceivers.length} AI receivers ${exclusionReason}`);
      } else {
        console.log(`No eligible AI receivers for message ${messageId} - all agents have reached reply limit or were filtered out`);
      }
    } else {
      console.log(`No AI agents in room ${roomId} to receive message ${messageId}`);
    }

    await this.ack();
  }
}

