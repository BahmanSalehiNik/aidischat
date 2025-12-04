// src/routes/get-messages.ts
import express, { Request, Response } from 'express';
import { Message } from '../models/message';
import { RoomParticipant } from '../models/room-participant';
import { Room } from '../models/room';
import { extractJWTPayload, loginRequired } from '@aichatwar/shared';

const router = express.Router();

/**
 * Wait for participant to be synced via Kafka event
 * This handles race conditions where the Kafka event hasn't been processed yet
 */
import { getParticipantWithRetry } from '../utils/waitForParticipant';

router.get('/api/rooms/:roomId/messages', extractJWTPayload, loginRequired, async (req: Request, res: Response) => {
  const { roomId } = req.params;
  const { page = 1, limit = 50 } = req.query;
  const userId = req.jwtPayload!.id;
  
  // DEBUG: Log request details
  console.log(`[get-messages] 📥 REQUEST RECEIVED:`, {
    roomId: roomId,
    userId: userId,
    userEmail: req.jwtPayload?.email,
    page: page,
    limit: limit,
    hasAuthHeader: !!req.headers.authorization,
    authHeaderPreview: req.headers.authorization ? `${req.headers.authorization.substring(0, 20)}...` : 'none',
  });

  // Check if user is a participant in the room (with retry logic for startup race conditions)
  const participant = await getParticipantWithRetry(roomId, userId);

  if (!participant) {
    return res.status(403).send({ error: 'Not authorized to access messages in this room' });
  }

  const skip = (Number(page) - 1) * Number(limit);

  // Log query details for debugging
  const totalMessages = await Message.countDocuments({ roomId });
  console.log(`[get-messages] Querying messages for room ${roomId}: page=${page}, limit=${limit}, skip=${skip}, total=${totalMessages}`);

  const messages = await Message.find({ roomId })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit))
    .lean();

  console.log(`[get-messages] Found ${messages.length} messages for room ${roomId} (requested ${limit}, total in DB: ${totalMessages})`);

  // Get all replyToMessageIds that need to be loaded
  const replyToMessageIds = messages
    .filter((msg: any) => msg.replyToMessageId)
    .map((msg: any) => msg.replyToMessageId);

  // Load all replied-to messages in one query
  const repliedToMessages = replyToMessageIds.length > 0
    ? await Message.find({ _id: { $in: replyToMessageIds } }).lean()
    : [];

  // Create a map for quick lookup
  const repliedToMap = new Map();
  repliedToMessages.forEach((msg: any) => {
    repliedToMap.set(msg._id?.toString() || msg.id, msg);
  });

  // Enrich messages with sender information and replyTo
  const enrichedMessages = messages.map((msg: any) => {
    // DEBUG: Log senderName for each message
    if (!msg.senderName) {
      console.warn(`[get-messages] ⚠️ Message ${msg._id || msg.id} has NO senderName:`, {
        messageId: msg._id || msg.id,
        senderId: msg.senderId,
        senderType: msg.senderType,
        roomId: msg.roomId,
        hasSenderName: !!msg.senderName,
        senderNameValue: msg.senderName,
      });
    }
    
    const messageObj: any = {
      ...msg,
      id: msg._id || msg.id,
      senderName: msg.senderName, // Include senderName directly in message
      replyToMessageId: msg.replyToMessageId || null,
      reactions: msg.reactions || [],
      reactionsSummary: (() => {
        if (!msg.reactions || msg.reactions.length === 0) return [];
        const reactionMap = new Map<string, number>();
        msg.reactions.forEach((r: any) => {
          reactionMap.set(r.emoji, (reactionMap.get(r.emoji) || 0) + 1);
        });
        return Array.from(reactionMap.entries()).map(([emoji, count]) => ({ emoji, count }));
      })(),
    };

    // Populate replyTo if this message is a reply
    if (msg.replyToMessageId) {
      const repliedToMsg = repliedToMap.get(msg.replyToMessageId?.toString());
      if (repliedToMsg) {
        // Ensure senderName is populated - use stored senderName or fallback
        const repliedToSenderName = repliedToMsg.senderName || 
          (repliedToMsg.senderId?.toString().includes('@') 
            ? repliedToMsg.senderId.toString().split('@')[0] 
            : `User ${repliedToMsg.senderId?.toString().slice(0, 8) || 'Unknown'}`);
        
        messageObj.replyTo = {
          id: repliedToMsg._id || repliedToMsg.id,
          senderId: repliedToMsg.senderId,
          senderName: repliedToSenderName,
          senderType: repliedToMsg.senderType,
          content: repliedToMsg.content,
          createdAt: repliedToMsg.createdAt,
          // Exclude attachments - not needed for preview card, user can jump to message to see full content
        };
      }
    }

    // Add sender info using stored senderName (denormalized) for backward compatibility
    if (msg.senderType === 'human' || msg.senderType === 'agent') {
      const senderId = msg.senderId?.toString();
      messageObj.sender = {
        id: senderId,
        name: msg.senderName || senderId?.slice(0, 8) || 'Unknown',
      };
    }

    return messageObj;
  });

  res.status(200).send({
    messages: enrichedMessages.reverse(), // Return in chronological order
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total: await Message.countDocuments({ roomId })
    }
  });
});

export { router as getMessagesRouter };
