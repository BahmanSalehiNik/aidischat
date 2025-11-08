// src/routes/create-room.ts
import express, { Request, Response } from 'express';
import crypto from 'crypto';
import { Room, RoomType } from '../models/room';
import { Participant } from '../models/room-participant';
import { kafkaWrapper } from '../kafka-client';
import { RoomCreatedPublisher } from '../events/publishers/room-created-publisher';
import { RoomParticipantAddedPublisher } from '../events/publishers/room-participant-added-publisher';
import { extractJWTPayload, loginRequired } from '@aichatwar/shared';
import { redisRoom, redisRoomPublisher, RedisKeys, RedisChannels } from '../redis-room';

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
  console.log(`[createRoom] Room saved successfully: ${room.id}, deletedAt: ${room.deletedAt}`);

  // Add creator as owner participant
  const participant = Participant.build({
    roomId: room.id,
    participantId: userId,
    participantType: 'human',
    role: 'owner',
  });
  await participant.save();

  // Update Redis: Add creator to room members set
  await redisRoom.sadd(RedisKeys.roomMembers(room.id), userId);
  
  // Update Redis: Track which room the user is in
  await redisRoom.hset(RedisKeys.userRooms(userId), room.id, Date.now().toString());
  
  // Set TTL on user's room tracking (5 minutes) - refreshed on activity
  await redisRoom.expire(RedisKeys.userRooms(userId), 300);

  // Store room metadata in Redis (optional)
  await redisRoom.hset(RedisKeys.roomMeta(room.id), {
    name: room.name || '',
    type: room.type,
    active: 'true',
  });

  // Get current room members for event
  const members = await redisRoom.smembers(RedisKeys.roomMembers(room.id));

  // Publish room created event to Redis pub/sub
  await redisRoomPublisher.publish(RedisChannels.roomEvents, JSON.stringify({
    type: 'room.created',
    roomId: room.id,
    createdBy: userId,
    members,
    timestamp: new Date().toISOString(),
  }));

  // Publish room created event
  await new RoomCreatedPublisher(kafkaWrapper.producer).publish({
    id: room.id,
    type: room.type,
    name: room.name,
    createdBy: { id: userId },
    visibility: room.visibility,
    createdAt: room.createdAt.toISOString(),
  });

  // Publish participant added event to Kafka
  await new RoomParticipantAddedPublisher(kafkaWrapper.producer).publish({
    roomId: room.id,
    participantId: userId,
    participantType: 'human',
    role: 'owner',
    addedAt: participant.joinedAt.toISOString(),
  });

  console.log(`[createRoom] Participant ${userId} added to room ${room.id}, Kafka event published`);

  res.status(201).send(room);
});

export { router as createRoomRouter };
