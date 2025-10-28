// src/routes/create-room.ts
import express, { Request, Response } from 'express';
import { Room, RoomType } from '../models/room';
import { Participant } from '../models/room-participant';
import { kafkaWrapper } from '../kafka-client';
import { RoomCreatedPublisher } from '../events/publishers/room-created-publisher';
import { RoomParticipantAddedPublisher } from '../events/publishers/room-participant-added-publisher';
import { extractJWTPayload, loginRequired } from '@aichatwar/shared';

const router = express.Router();

router.post('/api/rooms', extractJWTPayload, loginRequired, async (req: Request, res: Response) => {
  const { type, name, visibility } = req.body;
  const userId = req.jwtPayload!.id;

  const room = Room.build({
    id: crypto.randomUUID(),
    type,
    name,
    createdBy: userId,
    visibility
  });
  await room.save();

  // Add creator as owner participant
  const participant = Participant.build({
    roomId: room.id,
    participantId: userId,
    participantType: 'human',
    role: 'owner',
  });
  await participant.save();

  // Publish room created event
  await new RoomCreatedPublisher(kafkaWrapper.producer).publish({
    id: room.id,
    type: room.type,
    name: room.name,
    createdBy: { id: userId },
    visibility: room.visibility,
    createdAt: room.createdAt.toISOString(),
  });

  // Publish participant added event
  await new RoomParticipantAddedPublisher(kafkaWrapper.producer).publish({
    roomId: room.id,
    participantId: userId,
    participantType: 'human',
    role: 'owner',
    addedAt: participant.joinedAt.toISOString(),
  });

  res.status(201).send(room);
});

export { router as createRoomRouter };
