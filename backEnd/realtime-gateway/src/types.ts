import { WebSocket } from 'ws';

// WebSocket client with user context
export interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  roomIds?: Set<string>;
  isAlive?: boolean;
}

// Message ingest payload from client
export interface MessageIngestPayload {
  roomId: string;
  content: string;
  attachments?: Array<{ url: string; type: string; meta: any }>;
  dedupeKey?: string;
}

// Presence update payload
export interface PresenceUpdatePayload {
  roomId: string;
  status: 'online' | 'offline' | 'typing' | 'idle';
}

// Incoming WebSocket message types
export interface WSMessage {
  type: 'join' | 'leave' | 'message' | 'ping' | 'presence';
  payload?: any;
}

// Outgoing WebSocket message types
export interface WSBroadcastMessage {
  type: 'message' | 'presence' | 'room_update' | 'error';
  payload: any;
}

// Room participant info
export interface RoomParticipant {
  userId: string;
  joinedAt: string;
  status?: 'online' | 'offline' | 'typing' | 'idle';
}

