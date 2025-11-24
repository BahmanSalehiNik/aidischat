// src/routes/add-participant.ts
import express, { Request, Response } from 'express';
import { Participant } from '../models/room-participant';
import { kafkaWrapper } from '../kafka-client';
import { RoomParticipantAddedPublisher } from '../events/publishers/room-participant-added-publisher';
import { extractJWTPayload, loginRequired, RoomParticipantAddedEvent } from '@aichatwar/shared';
import { redisRoom, redisRoomPublisher, RedisKeys, RedisChannels } from '../redis-room';

const router = express.Router();

router.post('/api/rooms/:roomId/participants', extractJWTPayload, loginRequired, async (req: Request, res: Response) => {
  const { participantId, participantType, role } = req.body;
  const { roomId } = req.params;
  const inviterUserId = req.jwtPayload!.id;

  if (!participantId || !participantType) {
    return res.status(400).send({ error: 'participantId and participantType are required' });
  }

  if (!['human', 'agent'].includes(participantType)) {
    return res.status(400).send({ error: 'participantType must be human or agent' });
  }

  // Only existing participants may invite others (regardless of type)
  const inviterRecord = await Participant.findOne({
    roomId,
    participantId: inviterUserId,
    leftAt: { $exists: false }
  });

  if (!inviterRecord) {
    return res.status(403).send({ error: 'Only room participants can send invites' });
  }

  if (participantType === 'human' && participantId === inviterUserId) {
    return res.status(400).send({ error: 'You are already in this room' });
  }

  const existingParticipant = await Participant.findOne({
    roomId,
    participantId,
    leftAt: { $exists: false }
  });

  if (existingParticipant) {
    return res.status(200).send(existingParticipant);
  }

  const participant = Participant.build({ 
    roomId, 
    participantId, 
    participantType, 
    role,
    invitedByUserId: inviterUserId,
  });
  await participant.save();

  // Update Redis: Add user to room members set
  await redisRoom.sadd(RedisKeys.roomMembers(roomId), participantId);
  
  // Update Redis: Track which room the user is in
  await redisRoom.hset(RedisKeys.userRooms(participantId), roomId, Date.now().toString());
  
  // Set TTL on user's room tracking (5 minutes) - refreshed on activity
  // This acts as a failsafe if disconnect events are missed
  await redisRoom.expire(RedisKeys.userRooms(participantId), 300);

  // Get current room members for event
  const members = await redisRoom.smembers(RedisKeys.roomMembers(roomId));

  // Publish room membership change to Redis pub/sub
  await redisRoomPublisher.publish(RedisChannels.roomEvents, JSON.stringify({
    type: 'room.member.added',
    roomId,
    participantId,
    participantType,
    members,
    timestamp: new Date().toISOString(),
  }));

  const eventPayload: RoomParticipantAddedEvent['data'] & { invitedByUserId?: string } = {
    roomId,
    participantId,
    participantType,
    role,
    addedAt: participant.joinedAt.toISOString(),
    invitedByUserId: participant.invitedByUserId,
  };

  // Publish to Kafka for persistent events
  await new RoomParticipantAddedPublisher(kafkaWrapper.producer).publish(eventPayload);

  res.status(201).send(participant);
});

export { router as addParticipantRouter };
  