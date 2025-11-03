// src/routes/remove-participant.ts
import express, { Request, Response } from 'express';
import { Participant } from '../models/room-participant';
import { kafkaWrapper } from '../kafka-client';
import { RoomParticipantRemovedPublisher } from '../events/publishers/room-participant-removed-publisher';
import { extractJWTPayload, loginRequired } from '@aichatwar/shared';
import { redisRoom, redisRoomPublisher, RedisKeys, RedisChannels } from '../redis-room';

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

  // Update Redis: Remove user from room members set
  await redisRoom.srem(RedisKeys.roomMembers(roomId), participantId);
  
  // Update Redis: Remove room from user's room list
  await redisRoom.hdel(RedisKeys.userRooms(participantId), roomId);

  // Get current room members for event
  const members = await redisRoom.smembers(RedisKeys.roomMembers(roomId));

  // Publish room membership change to Redis pub/sub
  await redisRoomPublisher.publish(RedisChannels.roomEvents, JSON.stringify({
    type: 'room.member.removed',
    roomId,
    participantId,
    members,
    timestamp: new Date().toISOString(),
  }));

  // Publish to Kafka for persistent events
  await new RoomParticipantRemovedPublisher(kafkaWrapper.producer).publish({
    roomId,
    participantId,
    removedAt: participant.leftAt!.toISOString(),
  });

  res.status(200).send(participant);
});

export { router as removeParticipantRouter };
