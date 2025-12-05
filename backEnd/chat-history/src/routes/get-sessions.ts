// src/routes/get-sessions.ts
import express, { Request, Response } from 'express';
import { SessionManager } from '../services/session-manager';
import { extractJWTPayload, loginRequired } from '@aichatwar/shared';

const router = express.Router();

/**
 * GET /api/sessions
 * Get sessions for the authenticated user
 * Query params:
 * - roomId: optional, filter by room
 * - participantType: 'human' | 'agent' (default: 'human')
 * - limit: pagination limit (default: 50)
 * - offset: pagination offset (default: 0)
 * - includeActive: include active sessions (default: true)
 */
router.get('/api/sessions', extractJWTPayload, loginRequired, async (req: Request, res: Response) => {
  const userId = req.jwtPayload!.id;
  const { roomId, participantType = 'human', limit = 50, offset = 0, includeActive = 'true' } = req.query;

  try {
    const result = await SessionManager.getSessionsByParticipant(
      userId,
      participantType as 'human' | 'agent',
      {
        roomId: roomId as string | undefined,
        limit: Number(limit),
        offset: Number(offset),
        includeActive: includeActive === 'true',
      }
    );

    res.status(200).send({
      sessions: result.sessions,
      pagination: {
        total: result.total,
        limit: Number(limit),
        offset: Number(offset),
      },
    });
  } catch (error: any) {
    console.error('[get-sessions] Error:', error);
    res.status(500).send({ error: 'Failed to fetch sessions' });
  }
});

/**
 * GET /api/agents/:agentId/sessions
 * Get sessions for a specific agent (requires authentication)
 * Query params: same as /api/sessions
 */
router.get('/api/agents/:agentId/sessions', extractJWTPayload, loginRequired, async (req: Request, res: Response) => {
  const { agentId } = req.params;
  const { roomId, limit = 50, offset = 0, includeActive = 'true' } = req.query;

  try {
    const result = await SessionManager.getSessionsByParticipant(
      agentId,
      'agent',
      {
        roomId: roomId as string | undefined,
        limit: Number(limit),
        offset: Number(offset),
        includeActive: includeActive === 'true',
      }
    );

    res.status(200).send({
      sessions: result.sessions,
      pagination: {
        total: result.total,
        limit: Number(limit),
        offset: Number(offset),
      },
    });
  } catch (error: any) {
    console.error('[get-agent-sessions] Error:', error);
    res.status(500).send({ error: 'Failed to fetch agent sessions' });
  }
});

/**
 * GET /api/sessions/:sessionId
 * Get a specific session by ID
 */
router.get('/api/sessions/:sessionId', extractJWTPayload, loginRequired, async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const userId = req.jwtPayload!.id;

  console.log(`[get-session] Request: sessionId=${sessionId}, userId=${userId}`);

  try {
    const session = await SessionManager.getSessionById(sessionId);
    
    if (!session) {
      console.log(`[get-session] Session ${sessionId} not found`);
      return res.status(404).send({ error: 'Session not found' });
    }

    console.log(`[get-session] Found session ${sessionId}, roomId=${session.roomId}`);
    res.status(200).send({ session });
  } catch (error: any) {
    console.error('[get-session] Error:', error);
    res.status(500).send({ error: 'Failed to fetch session' });
  }
});

/**
 * GET /api/sessions/:sessionId/messages
 * Get messages for a specific session
 * Query params:
 * - limit: pagination limit (default: 100)
 * - offset: pagination offset (default: 0)
 */
router.get('/api/sessions/:sessionId/messages', extractJWTPayload, loginRequired, async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const { limit = 100, offset = 0 } = req.query;
  const userId = req.jwtPayload!.id;

  console.log(`[get-session-messages] Request: sessionId=${sessionId}, userId=${userId}, limit=${limit}, offset=${offset}`);

  try {
    // Note: In a production system, you'd want to verify the user has access to this session
    // For now, we'll return the message IDs - the client can fetch full messages from chat service
    
    const result = await SessionManager.getMessagesBySession(sessionId, {
      limit: Number(limit),
      offset: Number(offset),
    });

    console.log(`[get-session-messages] Response: sessionId=${sessionId}, total=${result.total}, messageIds.length=${result.messageIds.length}`);

    res.status(200).send({
      messageIds: result.messageIds,
      pagination: {
        total: result.total,
        limit: Number(limit),
        offset: Number(offset),
      },
    });
  } catch (error: any) {
    console.error('[get-session-messages] Error:', error);
    res.status(500).send({ error: 'Failed to fetch session messages' });
  }
});

/**
 * GET /api/sessions/by-message/:messageId
 * Find which session a message belongs to
 */
router.get('/api/sessions/by-message/:messageId', extractJWTPayload, loginRequired, async (req: Request, res: Response) => {
  const { messageId } = req.params;

  try {
    const session = await SessionManager.findSessionByMessageId(messageId);
    
    if (!session) {
      return res.status(404).send({ error: 'Session not found for this message' });
    }

    res.status(200).send({ session });
  } catch (error: any) {
    console.error('[get-session-by-message] Error:', error);
    res.status(500).send({ error: 'Failed to find session' });
  }
});

/**
 * GET /api/rooms/:roomId/sessions
 * Get all sessions in a room (regardless of participant)
 * This allows agents to see all messages in a room, including from other agents
 * Query params:
 * - limit: pagination limit (default: 50)
 * - offset: pagination offset (default: 0)
 * - includeActive: include active sessions (default: true)
 */
router.get('/api/rooms/:roomId/sessions', extractJWTPayload, loginRequired, async (req: Request, res: Response) => {
  const { roomId } = req.params;
  const { limit = 50, offset = 0, includeActive = 'true' } = req.query;

  try {
    const result = await SessionManager.getSessionsByRoom(roomId, {
      limit: Number(limit),
      offset: Number(offset),
      includeActive: includeActive === 'true',
    });

    res.status(200).send({
      sessions: result.sessions,
      pagination: {
        total: result.total,
        limit: Number(limit),
        offset: Number(offset),
      },
    });
  } catch (error: any) {
    console.error('[get-room-sessions] Error:', error);
    res.status(500).send({ error: 'Failed to fetch room sessions' });
  }
});

export { router as getSessionsRouter };

