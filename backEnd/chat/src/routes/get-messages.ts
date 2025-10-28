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
    .limit(Number(limit));

  res.status(200).send({
    messages: messages.reverse(), // Return in chronological order
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total: await Message.countDocuments({ roomId })
    }
  });
});

export { router as getMessagesRouter };
