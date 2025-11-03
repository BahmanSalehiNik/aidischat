// src/routes/delete-room.ts
import express, { Request, Response } from 'express';
import { Room } from '../models/room';
import { kafkaWrapper } from '../kafka-client';
import { RoomDeletedPublisher } from '../events/publishers/room-deleted-publisher';
import { extractJWTPayload, loginRequired } from '@aichatwar/shared';
import { redisRoom, redisRoomPublisher, RedisKeys, RedisChannels } from '../redis-room';

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

  // Get room members before deleting from Redis
  const members = await redisRoom.smembers(RedisKeys.roomMembers(roomId));

  // Clean up Redis: Remove all room-related keys
  await Promise.all([
    redisRoom.del(RedisKeys.roomMembers(roomId)),
    redisRoom.del(RedisKeys.roomMeta(roomId)),
    // Remove room from all users' room lists
    ...members.map((memberId: string) => 
      redisRoom.hdel(RedisKeys.userRooms(memberId), roomId)
    ),
  ]);

  // Publish room deleted event to Redis pub/sub
  await redisRoomPublisher.publish(RedisChannels.roomEvents, JSON.stringify({
    type: 'room.deleted',
    roomId: room.id,
    timestamp: new Date().toISOString(),
  }));

  // Publish to Kafka for persistent events
  await new RoomDeletedPublisher(kafkaWrapper.producer).publish({
    id: room.id,
    deletedAt: room.deletedAt!.toISOString(),
  });

  res.status(200).send(room);
});

export { router as deleteRoomRouter };
