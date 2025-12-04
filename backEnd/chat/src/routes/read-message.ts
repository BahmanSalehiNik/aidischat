// src/routes/read-message.ts
import express, { Request, Response } from 'express';
import { Message } from '../models/message';
import { RoomParticipant } from '../models/room-participant';
import { kafkaWrapper } from '../kafka-client';
import { MessageReadPublisher } from '../events/publishers/message-read-publisher';
import { extractJWTPayload, loginRequired } from '@aichatwar/shared';
import { getParticipantWithRetry } from '../utils/waitForParticipant';

const router = express.Router();

router.post('/api/messages/:messageId/read', extractJWTPayload, loginRequired, async (req: Request, res: Response) => {
  const { messageId } = req.params;
  const userId = req.jwtPayload!.id;

  const message = await Message.findOne({ _id: messageId });

  if (!message) {
    return res.status(404).send({ error: 'Message not found' });
  }

  // Check if user is a participant in the room (with retry logic for startup race conditions)
  const participant = await getParticipantWithRetry(message.roomId, userId);

  if (!participant) {
    return res.status(403).send({ error: 'Not authorized to read messages in this room' });
  }

  // Check if already read by this user
  const alreadyRead = message.readBy.some(read => read.participantId === userId);
  
  if (!alreadyRead) {
    message.readBy.push({
      participantId: userId,
      at: new Date()
    });
    await message.save();

    // Publish message read event
    await new MessageReadPublisher(kafkaWrapper.producer).publish({
      id: message.id,
      readBy: userId,
      readAt: new Date().toISOString(),
    });
  }

  res.status(200).send({ message: 'Message marked as read' });
});

export { router as readMessageRouter };
