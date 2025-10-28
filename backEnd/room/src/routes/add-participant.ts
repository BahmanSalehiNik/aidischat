// src/routes/add-participant.ts
import express, { Request, Response } from 'express';
import { Participant } from '../models/room-participant';
import { kafkaWrapper } from '../kafka-client';
import { RoomParticipantAddedPublisher } from '../events/publishers/room-participant-added-publisher';
import { extractJWTPayload, loginRequired } from '@aichatwar/shared';

const router = express.Router();

router.post('/api/rooms/:roomId/participants', extractJWTPayload, loginRequired, async (req: Request, res: Response) => {
  const { participantId, participantType, role } = req.body;
  const { roomId } = req.params;

  const participant = Participant.build({ 
    roomId, 
    participantId, 
    participantType, 
    role 
  });
  await participant.save();

  await new RoomParticipantAddedPublisher(kafkaWrapper.producer).publish({
    roomId,
    participantId,
    participantType,
    role,
    addedAt: participant.joinedAt.toISOString(),
  });

  res.status(201).send(participant);
});

export { router as addParticipantRouter };
  