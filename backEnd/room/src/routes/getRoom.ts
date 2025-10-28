// src/routes/get-room.ts
import express, { Request, Response } from 'express';
import { Room } from '../models/room';
import { Participant } from '../models/room-participant';
import { extractJWTPayload, loginRequired } from '@aichatwar/shared';

const router = express.Router();

router.get('/api/rooms/:roomId', extractJWTPayload, loginRequired, async (req: Request, res: Response) => {
  const { roomId } = req.params;
  const userId = req.jwtPayload!.id;

  // Check if user is a participant in the room
  const participant = await Participant.findOne({ 
    roomId, 
    participantId: userId,
    leftAt: { $exists: false }
  });

  if (!participant) {
    return res.status(403).send({ error: 'Not authorized to access this room' });
  }

  const room = await Room.findOne({ _id: roomId, deletedAt: { $exists: false } });

  if (!room) {
    return res.status(404).send({ error: 'Room not found' });
  }

  res.status(200).send(room);
});

export { router as getRoomRouter };
