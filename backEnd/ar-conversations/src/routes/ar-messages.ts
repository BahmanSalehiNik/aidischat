// src/routes/ar-messages.ts
import express, { Request, Response } from 'express';
import crypto from 'crypto';
import { ARMessage } from '../models/ar-message';
import { User } from '../models/user';
import { kafkaWrapper } from '../kafka-client';
import { ARMessageRequestPublisher } from '../events/publishers/ar-message-request-publisher';
import { extractJWTPayload, loginRequired } from '@aichatwar/shared';

// Helper to get or wait for user
async function waitForUser(userId: string, maxRetries = 5): Promise<any> {
  for (let i = 0; i < maxRetries; i++) {
    const user = await User.findOne({ _id: userId }).lean();
    if (user) return user;
    await new Promise(resolve => setTimeout(resolve, 200)); // Wait 200ms
  }
  return null;
}

const router = express.Router();

/**
 * POST /api/ar-rooms/:roomId/messages
 * Send a message in an AR room, triggers AI streaming
 */
router.post('/api/ar-rooms/:roomId/messages', extractJWTPayload, loginRequired, async (req: Request, res: Response) => {
  const { roomId } = req.params;
  const { content } = req.body;
  const userId = req.jwtPayload!.id;

  // TODO: Validate room access - check if user owns the AR room
  // For now, we'll trust the roomId is valid (will be enhanced later)

  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    return res.status(400).send({ error: 'Message content is required' });
  }

  const messageId = crypto.randomUUID();

  // Fetch user to get username (with retry for race conditions)
  const user = await waitForUser(userId);
  
  // Get username with fallback: displayName -> username -> email prefix (from DB or JWT) -> never use userId
  let username: string = '';
  if (user) {
    username = user.displayName || user.username || user.email?.split('@')[0] || '';
  }
  
  // If no username from DB, use email from JWT payload
  if (!username) {
    const emailFromJwt = (req.jwtPayload as any)?.email;
    if (emailFromJwt) {
      username = emailFromJwt.split('@')[0];
    } else {
      // Last resort: use a generic name (should never happen if JWT is valid)
      username = 'User';
      console.warn(`⚠️ [AR Messages] No email in JWT payload for user ${userId}, using generic 'User'`);
    }
  }

  // Format message with username: "username: message"
  const formattedContent = `${username}: ${content.trim()}`;

  // Create AR message with streaming status
  const arMessage = ARMessage.build({
    id: messageId,
    roomId,
    senderId: userId,
    senderType: 'human',
    content: content.trim(), // Store original content without username prefix
    status: 'streaming',
  });

  await arMessage.save();

  // Extract agentId from room (TODO: fetch from Room Service or pass in request)
  // For now, we'll need to get it from the room - this will be enhanced
  const agentId = req.body.agentId; // Temporary: should fetch from room

  if (!agentId) {
    return res.status(400).send({ error: 'Agent ID is required for AR rooms' });
  }

  // Publish AR message request event to trigger AI streaming
  // Send formatted content with username to AI Gateway
  try {
    await new ARMessageRequestPublisher(kafkaWrapper.producer).publish({
      messageId: arMessage.id,
      roomId: arMessage.roomId,
      agentId: agentId,
      userId: userId,
      content: formattedContent, // Send formatted message with username
      timestamp: new Date().toISOString(),
    });

    console.log(`✅ [AR Messages] Published ARMessageRequestEvent for message ${messageId} in room ${roomId}`);
  } catch (error: any) {
    console.error(`❌ [AR Messages] Failed to publish ARMessageRequestEvent:`, error.message);
    // Update message status to failed
    arMessage.status = 'failed';
    await arMessage.save();
    return res.status(500).send({ error: 'Failed to trigger AI streaming' });
  }

  res.status(201).send(arMessage.toJSON());
});

/**
 * GET /api/ar-rooms/:roomId/messages
 * Get message history for an AR room
 */
router.get('/api/ar-rooms/:roomId/messages', extractJWTPayload, loginRequired, async (req: Request, res: Response) => {
  const { roomId } = req.params;
  const userId = req.jwtPayload!.id;
  const { page = '1', limit = '50' } = req.query;

  const pageNum = parseInt(page as string, 10);
  const limitNum = parseInt(limit as string, 10);
  const skip = (pageNum - 1) * limitNum;

  // TODO: Validate room access - check if user owns the AR room

  const messages = await ARMessage.find({ roomId })
    .sort({ createdAt: -1 })
    .limit(limitNum)
    .skip(skip);

  const total = await ARMessage.countDocuments({ roomId });

  res.status(200).send({
    messages: messages.map(msg => msg.toJSON()),
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
    },
  });
});

export { router as arMessagesRouter };

