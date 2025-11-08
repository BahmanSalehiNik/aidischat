import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { useChatStore } from '../../store/chatStore';
import { roomApi, debugApi } from '../../utils/api';
import { Room } from '../../store/chatStore';
import { useGlobalWebSocket } from '../../hooks/useGlobalWebSocket';

export default function RoomListScreen() {
  const { user, logout } = useAuthStore();
  const { rooms, setRooms, setCurrentRoom } = useChatStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  useEffect(() => {
    loadRooms();
  }, []);

  // Listen for room.created events to refresh the list
  useGlobalWebSocket(() => {
    console.log('🔄 Refreshing room list due to room.created event');
    loadRooms();
  });

  const loadRooms = async () => {
    try {
      setLoading(true);
      const response = await roomApi.getUserRooms();
      console.log('📋 getUserRooms response type:', typeof response);
      console.log('📋 getUserRooms response:', JSON.stringify(response, null, 2));
      
      // Handle new response format: { rooms: Room[], pagination: {...} }
      let roomsArray: Room[] = [];
      
      if (response && typeof response === 'object') {
        if (Array.isArray(response)) {
          // Response is directly an array
          roomsArray = response;
        } else if ((response as any).rooms && Array.isArray((response as any).rooms)) {
          // Response has rooms property
          roomsArray = (response as any).rooms;
        } else {
          console.warn('⚠️ Unexpected response format:', response);
        }
      }
      
      console.log(`✅ Loaded ${roomsArray.length} rooms`);
      if (roomsArray.length > 0) {
        console.log('Rooms:', roomsArray.map((r: any) => ({ id: r.id, name: r.name, isParticipant: r.isParticipant })));
      } else {
        console.warn('⚠️ No rooms found in response');
      }
      
      setRooms(roomsArray);
    } catch (error) {
      console.error('❌ Error loading rooms:', error);
      // Set empty array on error to show empty state
      setRooms([]);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadRooms();
    setRefreshing(false);
  };

  const handleCreateRoom = async () => {
    try {
      const newRoom = await roomApi.createRoom({
        type: 'group',
        name: `Room ${Date.now()}`,
        visibility: 'private',
      });
      
      setRooms([...rooms, newRoom as Room]);
      
      // Navigate immediately - the retry mechanism in ChatScreen will handle the race condition
      router.push({
        pathname: '/(chat)/ChatScreen',
        params: { roomId: (newRoom as any).id },
      });
    } catch (error) {
      console.error('Error creating room:', error);
    }
  };

  const handleRoomPress = async (room: Room) => {
    try {
      // Check if user is already a participant
      const isParticipant = (room as any).isParticipant === true;
      
      console.log(`[handleRoomPress] Room ${room.id}, isParticipant: ${isParticipant}, role: ${(room as any).role}`);
      
      // If not a participant, join the room first
      if (!isParticipant) {
        console.log(`[handleRoomPress] User is not a participant, calling joinRoom...`);
        try {
          await roomApi.joinRoom(room.id);
          console.log(`✅ Joined room: ${room.id}`);
          
          // Poll to check if participant exists in chat service before navigating
          // This ensures the Kafka event has been processed
          const maxAttempts = 15; // Increased attempts
          const pollInterval = 500; // 500ms
          let participantExists = false;
          
          console.log(`🔄 Polling for participant sync: ${user?.id} in room ${room.id}`);
          
          for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
              if (user?.id) {
                const result: any = await debugApi.checkParticipant(room.id, user.id);
                console.log(`[Poll ${attempt + 1}] Participant check result:`, {
                  exists: result?.exists,
                  hasParticipant: !!result?.participant
                });
                
                if (result?.exists || result?.participant) {
                  participantExists = true;
                  console.log(`✅ Participant confirmed in chat service after ${attempt + 1} attempts`);
                  break;
                }
              }
            } catch (err: any) {
              // Debug endpoint might not exist or participant not found yet, continue polling
              const errorMsg = err?.message || 'Unknown error';
              console.log(`⏳ Waiting for participant sync... (attempt ${attempt + 1}/${maxAttempts}) - ${errorMsg}`);
            }
            
            if (attempt < maxAttempts - 1) {
              await new Promise(resolve => setTimeout(resolve, pollInterval));
            }
          }
          
          if (!participantExists) {
            console.warn(`⚠️ Participant not confirmed in chat service after ${maxAttempts} attempts, proceeding anyway`);
            console.warn(`⚠️ Chat screen will retry loading messages`);
          }
        } catch (error) {
          console.error('❌ Error joining room:', error);
          // Continue anyway - the chat screen will handle the 403 error with retries
        }
      }
      
      setCurrentRoom(room.id);
      router.push({
        pathname: '/(chat)/ChatScreen',
        params: { roomId: room.id },
      });
    } catch (error) {
      console.error('Error handling room press:', error);
    }
  };


  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Rooms</Text>
        <Text style={styles.headerSubtitle}>{user?.email}</Text>
      </View>

      <FlashList
        data={rooms}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.roomItem}
            onPress={() => handleRoomPress(item)}
          >
            <View style={styles.roomContent}>
              <Text style={styles.roomName}>
                {item.name || `Room ${item.id.slice(0, 8)}`}
              </Text>
              <Text style={styles.roomType}>{item.type}</Text>
            </View>
            <Text style={styles.roomArrow}>→</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No rooms yet</Text>
            <Text style={styles.emptySubtext}>Create a room to get started</Text>
          </View>
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      />

      <View style={styles.footer}>
        <TouchableOpacity style={styles.createButton} onPress={handleCreateRoom}>
          <Text style={styles.createButtonText}>+ Create Room</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.logoutButton} onPress={async () => {
          await logout();
          router.replace('/(auth)/LoginScreen');
        }}>
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    padding: 16,
    backgroundColor: '#F5F5F5',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  roomItem: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    alignItems: 'center',
    backgroundColor: '#FFF',
  },
  roomContent: {
    flex: 1,
  },
  roomName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  roomType: {
    fontSize: 14,
    color: '#666',
    textTransform: 'capitalize',
  },
  roomArrow: {
    fontSize: 20,
    color: '#999',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    backgroundColor: '#F5F5F5',
  },
  createButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 8,
  },
  createButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  logoutButton: {
    padding: 12,
    alignItems: 'center',
  },
  logoutButtonText: {
    color: '#D32F2F',
    fontSize: 14,
  },
});

