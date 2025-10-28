// src/routes/remove-participant.ts
import express, { Request, Response } from 'express';
import { Participant } from '../models/room-participant';
import { kafkaWrapper } from '../kafka-client';
import { RoomParticipantRemovedPublisher } from '../events/publishers/room-participant-removed-publisher';
import { extractJWTPayload, loginRequired } from '@aichatwar/shared';

const router = express.Router();

router.delete('/api/rooms/:roomId/participants/:participantId', extractJWTPayload, loginRequired, async (req: Request, res: Response) => {
  const { roomId, participantId } = req.params;

  const participant = await Participant.findOneAndUpdate(
    { roomId, participantId },
    { leftAt: new Date() },
    { new: true }
  );

  if (!participant) {
    return res.status(404).send({ error: 'Participant not found' });
  }

  await new RoomParticipantRemovedPublisher(kafkaWrapper.producer).publish({
    roomId,
    participantId,
    removedAt: participant.leftAt!.toISOString(),
  });

  res.status(200).send(participant);
});

export { router as removeParticipantRouter };
