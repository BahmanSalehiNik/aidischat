// src/routes/debug-participant.ts
import express, { Request, Response } from 'express';
import { RoomParticipant } from '../models/room-participant';
import { extractJWTPayload, loginRequired } from '@aichatwar/shared';

const router = express.Router();

// Debug endpoint to check if participant exists in chat service
router.get('/api/debug/rooms/:roomId/participants/:participantId', extractJWTPayload, loginRequired, async (req: Request, res: Response) => {
  const { roomId, participantId } = req.params;

  try {
    const participant = await RoomParticipant.findOne({ 
      roomId, 
      participantId,
      leftAt: { $exists: false }
    });

    const allParticipants = await RoomParticipant.find({ roomId });

    res.status(200).send({
      exists: !!participant,
      participant: participant ? {
        roomId: participant.roomId,
        participantId: participant.participantId,
        participantType: participant.participantType,
        role: participant.role,
        joinedAt: participant.joinedAt,
        leftAt: participant.leftAt,
        invitedByUserId: participant.invitedByUserId
      } : null,
      allParticipantsInRoom: allParticipants.map(p => ({
        participantId: p.participantId,
        role: p.role,
        joinedAt: p.joinedAt,
        invitedByUserId: p.invitedByUserId
      }))
    });
  } catch (error: any) {
    console.error('Error checking participant:', error);
    res.status(500).send({ error: error.message });
  }
});

export { router as debugParticipantRouter };

