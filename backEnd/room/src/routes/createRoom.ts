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
  const { type, name, visibility, capabilities, agentId } = req.body;
  const userId = req.jwtPayload!.id;

  // For AR rooms, set default capabilities and status
  let roomCapabilities = capabilities || [];
  let roomStatus: 'active' | 'paused' | 'ended' | undefined = undefined;
  
  if (type === RoomType.AR) {
    if (roomCapabilities.length === 0) {
      roomCapabilities = ['ar'];
    }
    roomStatus = 'active';
    
    // For AR rooms, check if room already exists for this user-agent pair
    if (agentId) {
      const existingARRoom = await Room.findOne({
        createdBy: userId,
        agentId: agentId,
        type: RoomType.AR,
        status: 'active',
        deletedAt: null,
      });
      
      if (existingARRoom) {
        // Update last activity
        existingARRoom.lastActivityAt = new Date();
        await existingARRoom.save();
        return res.status(200).send(existingARRoom);
      }
    }
  } else {
    // For non-AR rooms, default to chat capability
    if (roomCapabilities.length === 0) {
      roomCapabilities = ['chat'];
    }
  }

  const room = Room.build({
    id: crypto.randomUUID(),
    type,
    name,
    createdBy: userId,
    visibility,
    capabilities: roomCapabilities,
    agentId: type === RoomType.AR ? agentId : undefined,
    status: roomStatus,
    lastActivityAt: type === RoomType.AR ? new Date() : undefined,
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
    capabilities: room.capabilities || [],
    agentId: room.agentId,
    status: room.status,
    createdAt: room.createdAt.toISOString(),
  });

  // Publish participant added event to Kafka
  try {
    await new RoomParticipantAddedPublisher(kafkaWrapper.producer).publish({
      roomId: room.id,
      participantId: userId,
      participantType: 'human',
      role: 'owner',
      addedAt: participant.joinedAt.toISOString(),
    });
    console.log(`[createRoom] ✅ Participant ${userId} added to room ${room.id}, Kafka event published successfully`);
  } catch (error: any) {
    console.error(`[createRoom] ❌ Failed to publish RoomParticipantAdded event:`, {
      roomId: room.id,
      participantId: userId,
      error: error.message,
      stack: error.stack
    });
    // Continue anyway - participant is saved in room service
    // The chat service will eventually sync via the wait mechanism
  }

  res.status(201).send(room);
});

export { router as createRoomRouter };
