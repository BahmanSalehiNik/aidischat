// src/routes/get-user-rooms.ts
import express, { Request, Response } from 'express';
import { Room } from '../models/room';
import { Participant } from '../models/room-participant';
import { extractJWTPayload, loginRequired } from '@aichatwar/shared';

const router = express.Router();

router.get('/api/users/rooms', extractJWTPayload, loginRequired, async (req: Request, res: Response) => {
  const userId = req.jwtPayload!.id;

  // Find all rooms where user is a participant and hasn't left
  const participants = await Participant.find({
    participantId: userId,
    participantType: 'human',
    leftAt: { $exists: false }
  });

  const roomIds = participants.map(p => p.roomId);

  // Get room details for all rooms user is in
  const rooms = await Room.find({
    _id: { $in: roomIds },
    deletedAt: { $exists: false }
  }).sort({ createdAt: -1 });

  // Include participant info (role) for each room
  const roomsWithParticipantInfo = rooms.map(room => {
    const participant = participants.find(p => p.roomId === room.id);
    return {
      ...room.toJSON(),
      role: participant?.role || 'member',
      joinedAt: participant?.joinedAt,
    };
  });

  res.status(200).send(roomsWithParticipantInfo);
});

export { router as getUserRoomsRouter };

