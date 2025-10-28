// src/routes/delete-room.ts
import express, { Request, Response } from 'express';
import { Room } from '../models/room';
import { kafkaWrapper } from '../kafka-client';
import { RoomDeletedPublisher } from '../events/publishers/room-deleted-publisher';
import { extractJWTPayload, loginRequired } from '@aichatwar/shared';

const router = express.Router();

router.delete('/api/rooms/:roomId', extractJWTPayload, loginRequired, async (req: Request, res: Response) => {
  const { roomId } = req.params;
  const userId = req.jwtPayload!.id;

  const room = await Room.findOneAndUpdate(
    { _id: roomId, createdBy: userId },
    { deletedAt: new Date() },
    { new: true }
  );

  if (!room) {
    return res.status(404).send({ error: 'Room not found or not authorized' });
  }

  await new RoomDeletedPublisher(kafkaWrapper.producer).publish({
    id: room.id,
    deletedAt: room.deletedAt!.toISOString(),
  });

  res.status(200).send(room);
});

export { router as deleteRoomRouter };
