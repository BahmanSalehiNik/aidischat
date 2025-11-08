import { useEffect, useRef, useCallback } from 'react';
import { WS_URL } from '@env';
import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore';

const RECONNECT_DELAY = 2000;
const MAX_RECONNECT_DELAY = 30000;
const HEARTBEAT_INTERVAL = 30000; // 30 seconds

/**
 * Global WebSocket hook for listening to room-level events (room.created, room.deleted)
 * This connection is not tied to a specific room and stays connected while the app is active
 */
export const useGlobalWebSocket = (onRoomCreated?: () => void) => {
  const { token } = useAuthStore();
  const { removeRoom } = useChatStore();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const wsUrl = WS_URL || 'ws://localhost:3000';

  const connect = useCallback(() => {
    if (!token) {
      console.log('⚠️ Cannot connect global WebSocket: missing token');
      return;
    }

    // Clean up existing connection
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    try {
      // Connect with token in query parameter
      const wsUrlWithToken = `${wsUrl}?token=${token}`;
      console.log(`🔗 Connecting to global WebSocket: ${wsUrlWithToken.replace(/token=[^&]+/, 'token=***')}`);
      
      const ws = new WebSocket(wsUrlWithToken);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log(`✅ Global WebSocket connected`);
        reconnectAttemptsRef.current = 0;

        // Start heartbeat
        heartbeatIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, HEARTBEAT_INTERVAL);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          console.log(`📨 [GlobalWS] Received: ${msg.type}`, msg.payload ? { roomId: msg.payload.roomId } : '');

          switch (msg.type) {
            case 'pong':
              // Heartbeat response, no action needed
              break;

            case 'room.created':
              console.log(`📢 [GlobalWS] Room created event received: ${msg.payload?.roomId}`);
              // Trigger room list refresh
              if (onRoomCreated) {
                console.log(`🔄 [GlobalWS] Calling onRoomCreated callback`);
                onRoomCreated();
              } else {
                console.warn(`⚠️ [GlobalWS] onRoomCreated callback not provided`);
              }
              break;

            case 'room.deleted':
              console.log(`🗑️ Room deleted: ${msg.payload?.roomId}`);
              if (msg.payload?.roomId) {
                removeRoom(msg.payload.roomId);
              }
              break;

            default:
              // Ignore other message types (they're handled by useWebSocket)
              break;
          }
        } catch (error) {
          console.error('Error parsing global WebSocket message:', error);
        }
      };

      ws.onerror = (event: Event) => {
        console.error('❌ Global WebSocket error:', event);
      };

      ws.onclose = (event) => {
        console.log('🔌 Global WebSocket closed', event.code, event.reason);

        // Clean up heartbeat
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
          heartbeatIntervalRef.current = null;
        }

        // Attempt reconnect if not a normal closure
        if (event.code !== 1000) {
          const delay = Math.min(
            RECONNECT_DELAY * Math.pow(2, reconnectAttemptsRef.current),
            MAX_RECONNECT_DELAY
          );
          
          console.log(`🔄 Reconnecting global WebSocket in ${delay}ms... (attempt ${reconnectAttemptsRef.current + 1})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current++;
            connect();
          }, delay);
        }
      };
    } catch (error) {
      console.error('Failed to create global WebSocket connection:', error);
    }
  }, [token, onRoomCreated, removeRoom, wsUrl]);

  useEffect(() => {
    connect();

    return () => {
      // Cleanup on unmount
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounted');
        wsRef.current = null;
      }
    };
  }, [connect]);
};

