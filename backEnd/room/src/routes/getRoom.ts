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
    console.warn(`[getRoom] User ${userId} is not a participant in room ${roomId}`);
    return res.status(403).send({ error: 'Not authorized to access this room' });
  }
  
  console.log(`[getRoom] User ${userId} is a participant in room ${roomId}, fetching room details`);

  // Check if room exists and is not deleted
  // Note: deletedAt has default: null in schema, so we check for null or not existing
  const room = await Room.findOne({
    _id: roomId,
    $or: [
      { deletedAt: null },
      { deletedAt: { $exists: false } }
    ]
  });

  if (!room) {
    console.error(`[getRoom] Room ${roomId} not found or deleted for user ${userId}`);
    return res.status(404).send({ error: 'Room not found' });
  }

  res.status(200).send(room);
});

export { router as getRoomRouter };
