// src/services/session-manager.ts
import { Session, SessionDoc } from '../models/session';
import { MessageSessionLink } from '../models/message-session-link';
import { SESSION_INACTIVITY_TIMEOUT_MS } from '../constants';
import crypto from 'crypto';

export class SessionManager {
  /**
   * Get or create an active session for a participant in a room
   * Uses messageId-based tracking with time as fallback for inactivity detection
   * 
   * Strategy:
   * 1. Check if there's an active session (not ended and within timeout)
   * 2. If found, check if the new message should continue the session or start a new one
   * 3. If no active session or message gap detected, create a new session
   */
  static async getOrCreateActiveSession(
    roomId: string,
    participantId: string,
    participantType: 'human' | 'agent',
    messageId: string,
    messageCreatedAt: Date
  ): Promise<SessionDoc> {
    const now = new Date();
    const timeoutThreshold = new Date(now.getTime() - SESSION_INACTIVITY_TIMEOUT_MS);

    // Find the most recent active session (not ended and within timeout threshold)
    const activeSession = await Session.findOne({
      roomId,
      participantId,
      participantType,
      endTime: { $exists: false },
      lastActivityTime: { $gte: timeoutThreshold }
    }).sort({ startTime: -1 });

    if (activeSession) {
      // Check if this message should continue the current session
      // If message time is within timeout threshold, continue the session
      if (messageCreatedAt.getTime() >= timeoutThreshold.getTime()) {
        // Update last activity time and last message ID
        activeSession.lastActivityTime = messageCreatedAt;
        activeSession.lastMessageId = messageId;
        await activeSession.save();
        return activeSession;
      } else {
        // Message is too old (out of order), but session is still active
        // This can happen with message ordering - we'll still link it to the session
        // but won't update lastMessageId if this message is older than current lastMessageId
        const shouldUpdateLastMessage = messageCreatedAt > new Date(activeSession.lastActivityTime);
        if (shouldUpdateLastMessage) {
          activeSession.lastActivityTime = messageCreatedAt;
          activeSession.lastMessageId = messageId;
        }
        await activeSession.save();
        return activeSession;
      }
    }

    // Check if there's a recent session that just timed out - end it
    const timedOutSession = await Session.findOne({
      roomId,
      participantId,
      participantType,
      endTime: { $exists: false },
      lastActivityTime: { $lt: timeoutThreshold }
    }).sort({ startTime: -1 });

    if (timedOutSession) {
      timedOutSession.endTime = timedOutSession.lastActivityTime;
      await timedOutSession.save();
    }

    // Create a new session with this message as the first message
    const sessionId = crypto.randomUUID();
    const newSession = Session.build({
      id: sessionId,
      roomId,
      participantId,
      participantType,
      startTime: messageCreatedAt,
      lastActivityTime: messageCreatedAt,
      firstMessageId: messageId,
      lastMessageId: messageId,
      messageCount: 0,
    });

    await newSession.save();
    console.log(`[SessionManager] Created new session ${sessionId} for ${participantType} ${participantId} in room ${roomId} starting with message ${messageId}`);
    
    return newSession;
  }

  /**
   * Link a message to a session and update session activity
   * Uses messageId-based session tracking for accurate conversation boundaries
   */
  static async linkMessageToSession(
    messageId: string,
    roomId: string,
    participantId: string,
    participantType: 'human' | 'agent',
    messageCreatedAt: Date
  ): Promise<void> {
    // Check if message is already linked (idempotency)
    const existingLink = await MessageSessionLink.findOne({ messageId });
    if (existingLink) {
      console.log(`[SessionManager] Message ${messageId} already linked to session ${existingLink.sessionId}`);
      return;
    }

    // Get or create active session (pass messageId and timestamp for message-based tracking)
    const session = await this.getOrCreateActiveSession(
      roomId,
      participantId,
      participantType,
      messageId,
      messageCreatedAt
    );

    // Create link
    const link = MessageSessionLink.build({
      messageId,
      sessionId: session.id,
      roomId,
      participantId,
      participantType,
      createdAt: messageCreatedAt,
    });

    await link.save();

    // Update session message count
    // Note: lastMessageId and lastActivityTime are already updated in getOrCreateActiveSession
    session.messageCount += 1;
    await session.save();

    console.log(`[SessionManager] Linked message ${messageId} to session ${session.id} (first: ${session.firstMessageId}, last: ${session.lastMessageId})`);
  }

  /**
   * Find session by messageId (useful for querying which session a message belongs to)
   */
  static async findSessionByMessageId(messageId: string): Promise<SessionDoc | null> {
    const link = await MessageSessionLink.findOne({ messageId });
    if (!link) {
      return null;
    }
    return await Session.findOne({ _id: link.sessionId });
  }

  /**
   * Get session boundaries by messageId range
   * Useful for finding all sessions that contain messages in a specific range
   */
  static async getSessionsByMessageRange(
    roomId: string,
    participantId: string,
    participantType: 'human' | 'agent',
    fromMessageId?: string,
    toMessageId?: string
  ): Promise<SessionDoc[]> {
    // This would require message ordering/sequence numbers to be fully accurate
    // For now, we'll use time-based queries as a fallback
    // TODO: Enhance when message ordering is implemented
    const query: any = {
      roomId,
      participantId,
      participantType,
    };

    const sessions = await Session.find(query)
      .sort({ startTime: -1 })
      .lean();

    // Transform _id to id for lean results (toJSON transform doesn't apply to lean)
    return sessions.map((session: any) => ({
      ...session,
      id: session._id || session.id,
    })) as any;
  }

  /**
   * End a session explicitly
   */
  static async endSession(sessionId: string): Promise<void> {
    const session = await Session.findOne({ _id: sessionId });
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    if (session.endTime) {
      console.log(`[SessionManager] Session ${sessionId} already ended`);
      return;
    }

    session.endTime = new Date();
    await session.save();
    console.log(`[SessionManager] Ended session ${sessionId}`);
  }

  /**
   * Get sessions for a participant (user or agent)
   */
  static async getSessionsByParticipant(
    participantId: string,
    participantType: 'human' | 'agent',
    options: {
      roomId?: string;
      limit?: number;
      offset?: number;
      includeActive?: boolean;
    } = {}
  ): Promise<{ sessions: SessionDoc[]; total: number }> {
    const { roomId, limit = 50, offset = 0, includeActive = true } = options;

    const query: any = {
      participantId,
      participantType,
    };

    if (roomId) {
      query.roomId = roomId;
    }

    if (!includeActive) {
      query.endTime = { $exists: true };
    }

    const sessions = await Session.find(query)
      .sort({ startTime: -1 })
      .skip(offset)
      .limit(limit)
      .lean();

    const total = await Session.countDocuments(query);

    // Transform _id to id for lean results (toJSON transform doesn't apply to lean)
    const transformedSessions = sessions.map((session: any) => ({
      ...session,
      id: session._id || session.id,
    }));

    return { sessions: transformedSessions as any, total };
  }

  /**
   * Get all sessions in a room (regardless of participant)
   * Useful for viewing all messages in a room, including from different agents
   */
  static async getSessionsByRoom(
    roomId: string,
    options: {
      limit?: number;
      offset?: number;
      includeActive?: boolean;
    } = {}
  ): Promise<{ sessions: SessionDoc[]; total: number }> {
    const { limit = 50, offset = 0, includeActive = true } = options;

    const query: any = {
      roomId,
    };

    if (!includeActive) {
      query.endTime = { $exists: true };
    }

    const sessions = await Session.find(query)
      .sort({ startTime: -1 })
      .skip(offset)
      .limit(limit)
      .lean();

    const total = await Session.countDocuments(query);

    // Transform _id to id for lean results (toJSON transform doesn't apply to lean)
    const transformedSessions = sessions.map((session: any) => ({
      ...session,
      id: session._id || session.id,
    }));

    return { sessions: transformedSessions as any, total };
  }

  /**
   * Get a session by ID
   */
  static async getSessionById(sessionId: string): Promise<any> {
    const session = await Session.findOne({ _id: sessionId }).lean();
    if (!session) return null;
    // Transform _id to id for lean results (toJSON transform doesn't apply to lean)
    return {
      ...session,
      id: session._id || session.id,
    };
  }

  /**
   * Get messages for a session
   */
  static async getMessagesBySession(
    sessionId: string,
    options: {
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ messageIds: string[]; total: number }> {
    const { limit = 100, offset = 0 } = options;

    const links = await MessageSessionLink.find({ sessionId })
      .sort({ createdAt: 1 }) // Chronological order
      .skip(offset)
      .limit(limit)
      .lean();

    const total = await MessageSessionLink.countDocuments({ sessionId });

    console.log(`[SessionManager] getMessagesBySession: sessionId=${sessionId}, found ${links.length} links, total=${total}`);

    return {
      messageIds: links.map(link => link.messageId),
      total,
    };
  }
}

