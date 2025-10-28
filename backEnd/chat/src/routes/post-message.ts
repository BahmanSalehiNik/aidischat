// src/routes/post-message.ts
import express, { Request, Response } from 'express';
import { Message } from '../models/message';
import { RoomParticipant } from '../models/room-participant';
import { kafkaWrapper } from '../kafka-client';
import { MessageCreatedPublisher } from '../events/publishers/message-created-publisher';
import { extractJWTPayload, loginRequired } from '@aichatwar/shared';

const router = express.Router();

router.post('/api/rooms/:roomId/messages', extractJWTPayload, loginRequired, async (req: Request, res: Response) => {
  const { roomId } = req.params;
  const { content, attachments } = req.body;
  const userId = req.jwtPayload!.id;

  // Check if user is a participant in the room
  const participant = await RoomParticipant.findOne({ 
    roomId, 
    participantId: userId,
    leftAt: { $exists: false }
  });

  if (!participant) {
    return res.status(403).send({ error: 'Not authorized to send messages to this room' });
  }

  const messageId = crypto.randomUUID();
  const dedupeKey = `${roomId}-${userId}-${Date.now()}`;

  const message = Message.build({
    id: messageId,
    roomId,
    senderType: 'human',
    senderId: userId,
    content,
    attachments: attachments || [],
    dedupeKey
  });

  await message.save();

  // Publish message created event
  await new MessageCreatedPublisher(kafkaWrapper.producer).publish({
    id: message.id,
    roomId: message.roomId,
    senderType: message.senderType,
    senderId: message.senderId,
    content: message.content,
    attachments: message.attachments,
    createdAt: message.createdAt.toISOString(),
    dedupeKey: message.dedupeKey,
  });

  res.status(201).send(message);
});

export { router as postMessageRouter };
