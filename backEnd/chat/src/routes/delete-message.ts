// src/routes/delete-message.ts
import express, { Request, Response } from 'express';
import { Message } from '../models/message';
import { RoomParticipant } from '../models/room-participant';
import { kafkaWrapper } from '../kafka-client';
import { MessageDeletedPublisher } from '../events/publishers/message-deleted-publisher';
import { extractJWTPayload, loginRequired } from '@aichatwar/shared';
import { getParticipantWithRetry } from '../utils/waitForParticipant';

const router = express.Router();

router.delete('/api/messages/:messageId', extractJWTPayload, loginRequired, async (req: Request, res: Response) => {
  const { messageId } = req.params;
  const userId = req.jwtPayload!.id;

  const message = await Message.findOne({ _id: messageId });

  if (!message) {
    return res.status(404).send({ error: 'Message not found' });
  }

  // Check if user is the sender
  if (message.senderId !== userId) {
    return res.status(403).send({ error: 'Not authorized to delete this message' });
  }

  // Check if user is still a participant in the room (with retry logic for startup race conditions)
  const participant = await getParticipantWithRetry(message.roomId, userId);

  if (!participant) {
    return res.status(403).send({ error: 'Not authorized to delete messages in this room' });
  }

  await Message.deleteOne({ _id: messageId });

  // Publish message deleted event
  await new MessageDeletedPublisher(kafkaWrapper.producer).publish({
    id: message.id,
    deletedAt: new Date().toISOString(),
  });

  res.status(200).send({ message: 'Message deleted successfully' });
});

export { router as deleteMessageRouter };
