import { useEffect, useRef, useCallback, useState } from 'react';
import { WS_URL } from '@env';
import { useChatStore, Message } from '../store/chatStore';
import { useAuthStore } from '../store/authStore';

const RECONNECT_DELAY = 2000;
const MAX_RECONNECT_DELAY = 30000;
const HEARTBEAT_INTERVAL = 30000; // 30 seconds

export const useWebSocket = (roomId: string | null) => {
  const { token } = useAuthStore();
  const { addMessage, setRoomMembers, removeRoom } = useChatStore();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const wsUrl = WS_URL || 'ws://localhost:3000';

  const connect = useCallback(() => {
    if (!token || !roomId) {
      console.log('⚠️ Cannot connect: missing token or roomId');
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
      console.log(`🔗 Connecting to WebSocket: ${wsUrlWithToken.replace(/token=[^&]+/, 'token=***')}`);
      
      const ws = new WebSocket(wsUrlWithToken);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log(`✅ WebSocket connected`);
        setIsConnected(true);
        setConnectionError(null);
        reconnectAttemptsRef.current = 0;

        // Join the room
        if (roomId) {
          ws.send(JSON.stringify({
            type: 'join',
            roomId,
          }));
        }

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
          console.log('📨 Received message:', msg.type);

          switch (msg.type) {
            case 'pong':
              // Heartbeat response, no action needed
              break;

            case 'room.joined':
              console.log(`✅ Joined room ${msg.payload.roomId}`);
              if (msg.payload.members) {
                setRoomMembers(msg.payload.roomId, msg.payload.members);
              }
              break;

            case 'room.membership':
              console.log(`👥 Room membership changed: ${msg.payload.action}`);
              if (msg.payload.members) {
                setRoomMembers(msg.payload.roomId, msg.payload.members);
              }
              break;

            case 'room.deleted':
              console.log(`🗑️ Room deleted: ${msg.payload.roomId}`);
              removeRoom(msg.payload.roomId);
              break;

            case 'message':
              // Message from server
              if (msg.data) {
                console.log(`📨 Received message via WebSocket:`, {
                  id: msg.data.id,
                  roomId: msg.data.roomId,
                  senderId: msg.data.senderId,
                  content: msg.data.content?.substring(0, 50)
                });
                const message: Message = {
                  id: msg.data.id || `temp-${Date.now()}`,
                  roomId: msg.data.roomId,
                  senderId: msg.data.senderId,
                  senderType: msg.data.senderType || 'human',
                  senderName: msg.data.senderName, // Use denormalized sender name from event
                  content: msg.data.content,
                  createdAt: msg.data.createdAt || new Date().toISOString(),
                  attachments: msg.data.attachments,
                  sender: msg.data.sender, // Preserve sender info if present (for backward compatibility)
                };
                addMessage(msg.data.roomId, message);
              } else {
                console.warn(`⚠️ Received message event without data:`, msg);
              }
              break;

            case 'error':
              console.error('❌ WebSocket error:', msg.payload?.message);
              setConnectionError(msg.payload?.message || 'Unknown error');
              break;

            default:
              console.log('Unknown message type:', msg.type);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        setConnectionError('Connection error');
        setIsConnected(false);
      };

      ws.onclose = (event) => {
        console.log('🔌 WebSocket closed', event.code, event.reason);
        setIsConnected(false);

        // Clean up heartbeat
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
          heartbeatIntervalRef.current = null;
        }

        // Attempt reconnect if not a normal closure
        if (event.code !== 1000 && roomId) {
          const delay = Math.min(
            RECONNECT_DELAY * Math.pow(2, reconnectAttemptsRef.current),
            MAX_RECONNECT_DELAY
          );
          
          console.log(`🔄 Reconnecting in ${delay}ms... (attempt ${reconnectAttemptsRef.current + 1})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current++;
            connect();
          }, delay);
        }
      };
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setConnectionError('Failed to connect');
      setIsConnected(false);
    }
  }, [token, roomId, addMessage, setRoomMembers, removeRoom, wsUrl]);

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

  const sendMessage = useCallback((content: string, tempId?: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.error('Cannot send message: WebSocket not connected');
      return false;
    }

    if (!roomId) {
      console.error('Cannot send message: no roomId');
      return false;
    }

    try {
      // Optimistic update
      if (tempId) {
        const optimisticMessage: Message = {
          id: tempId,
          roomId,
          senderId: useAuthStore.getState().user?.id || '',
          senderType: 'human',
          content,
          createdAt: new Date().toISOString(),
          tempId,
        };
        addMessage(roomId, optimisticMessage);
      }

      wsRef.current.send(JSON.stringify({
        type: 'message.send',
        roomId,
        content,
        tempId,
      }));

      return true;
    } catch (error) {
      console.error('Error sending message:', error);
      return false;
    }
  }, [roomId, addMessage]);

  const joinRoom = useCallback((targetRoomId: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.error('Cannot join room: WebSocket not connected');
      return false;
    }

    try {
      wsRef.current.send(JSON.stringify({
        type: 'join',
        roomId: targetRoomId,
      }));
      return true;
    } catch (error) {
      console.error('Error joining room:', error);
      return false;
    }
  }, []);

  return {
    sendMessage,
    joinRoom,
    isConnected,
    connectionError,
  };
};

