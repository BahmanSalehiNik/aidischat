// src/routes/get-messages.ts
import express, { Request, Response } from 'express';
import { Message } from '../models/message';
import { RoomParticipant } from '../models/room-participant';
import { extractJWTPayload, loginRequired } from '@aichatwar/shared';

const router = express.Router();

router.get('/api/rooms/:roomId/messages', extractJWTPayload, loginRequired, async (req: Request, res: Response) => {
  const { roomId } = req.params;
  const { page = 1, limit = 50 } = req.query;
  const userId = req.jwtPayload!.id;

  // Check if user is a participant in the room
  const participant = await RoomParticipant.findOne({ 
    roomId, 
    participantId: userId,
    leftAt: { $exists: false }
  });

  if (!participant) {
    return res.status(403).send({ error: 'Not authorized to access messages in this room' });
  }

  const skip = (Number(page) - 1) * Number(limit);

  const messages = await Message.find({ roomId })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit))
    .lean();

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
