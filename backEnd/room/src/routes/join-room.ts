// src/routes/join-room.ts
import express, { Request, Response } from 'express';
import { Participant } from '../models/room-participant';
import { Room } from '../models/room';
import { kafkaWrapper } from '../kafka-client';
import { RoomParticipantAddedPublisher } from '../events/publishers/room-participant-added-publisher';
import { extractJWTPayload, loginRequired } from '@aichatwar/shared';
import { redisRoom, redisRoomPublisher, RedisKeys, RedisChannels } from '../redis-room';

const router = express.Router();

// Join a room - adds the current user as a participant
router.post('/api/rooms/:roomId/join', extractJWTPayload, loginRequired, async (req: Request, res: Response) => {
  const { roomId } = req.params;
  const userId = req.jwtPayload!.id;
  
  console.log(`[joinRoom] User ${userId} attempting to join room ${roomId}`);

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
    console.log(`[joinRoom] Room ${roomId} not found or deleted`);
    return res.status(404).send({ error: 'Room not found' });
  }
  
  console.log(`[joinRoom] Room ${roomId} found, checking participant status`);

  // Check if user is already a participant
  const existingParticipant = await Participant.findOne({
    roomId,
    participantId: userId,
    leftAt: { $exists: false }
  });

  if (existingParticipant) {
    // User is already a participant, return success
    console.log(`[joinRoom] User ${userId} is already a participant in room ${roomId}`);
    return res.status(200).send({
      ...existingParticipant.toJSON(),
      alreadyJoined: true
    });
  }
  
  console.log(`[joinRoom] User ${userId} is NOT a participant, proceeding to create participant`);

  // Create new participant
  console.log(`[joinRoom] Creating new participant for user ${userId} in room ${roomId}`);
  const participant = Participant.build({
    roomId,
    participantId: userId,
    participantType: 'human',
    role: 'member' // Default role for joining users
  });
  await participant.save();
  console.log(`[joinRoom] Participant saved in room service: ${participant.id}`);

  // Update Redis: Add user to room members set
  await redisRoom.sadd(RedisKeys.roomMembers(roomId), userId);
  
  // Update Redis: Track which room the user is in
  await redisRoom.hset(RedisKeys.userRooms(userId), roomId, Date.now().toString());
  
  // Set TTL on user's room tracking (5 minutes) - refreshed on activity
  await redisRoom.expire(RedisKeys.userRooms(userId), 300);

  // Get current room members for event
  const members = await redisRoom.smembers(RedisKeys.roomMembers(roomId));

  // Publish room membership change to Redis pub/sub
  await redisRoomPublisher.publish(RedisChannels.roomEvents, JSON.stringify({
    type: 'room.member.added',
    roomId,
    participantId: userId,
    participantType: 'human',
    members,
    timestamp: new Date().toISOString(),
  }));

  // Publish to Kafka for persistent events
  try {
    await new RoomParticipantAddedPublisher(kafkaWrapper.producer).publish({
      roomId,
      participantId: userId,
      participantType: 'human',
      role: 'member',
      addedAt: participant.joinedAt.toISOString(),
    });
    console.log(`[joinRoom] Participant ${userId} added to room ${roomId}, Kafka event published`);
  } catch (error: any) {
    console.error(`[joinRoom] ❌ Failed to publish Kafka event:`, {
      roomId,
      participantId: userId,
      error: error.message,
      stack: error.stack
    });
    // Continue anyway - participant is saved in room service
    // The event can be retried or manually synced
  }

  res.status(201).send({
    ...participant.toJSON(),
    alreadyJoined: false
  });
});

export { router as joinRoomRouter };

