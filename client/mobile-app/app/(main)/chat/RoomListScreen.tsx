import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../../store/authStore';
import { useChatStore } from '../../../store/chatStore';
import { roomApi, debugApi } from '../../../utils/api';
import { Room } from '../../../store/chatStore';
import { useGlobalWebSocket } from '../../../hooks/useGlobalWebSocket';
import { RoomItem } from '../../../components/chat/RoomItem';
import { CreateRoomModal } from '../../../components/chat/CreateRoomModal';
import { roomListScreenStyles as styles } from '../../../styles/chat/roomListScreenStyles';

export default function RoomListScreen() {
  const { user } = useAuthStore();
  const { rooms, setRooms, setCurrentRoom } = useChatStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [roomType, setRoomType] = useState<'group' | 'direct'>('group');
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [creating, setCreating] = useState(false);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    loadRooms();
  }, []);

  // Ensure RoomListScreen is shown when chat tab is focused
  // This prevents staying on SessionDetailScreen when switching to chat tab
  useFocusEffect(
    React.useCallback(() => {
      // When this screen is focused (chat tab clicked), ensure we're on RoomListScreen
      // This helps separate history view from main chat
      return () => {
        // Cleanup if needed
      };
    }, [])
  );

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
      
      let roomsArray: Room[] = [];
      
      if (response && typeof response === 'object') {
        if (Array.isArray(response)) {
          roomsArray = response;
        } else if ((response as any).rooms && Array.isArray((response as any).rooms)) {
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
    if (!roomName.trim()) {
      return;
    }

    try {
      setCreating(true);
      const newRoom = await roomApi.createRoom({
        type: roomType,
        name: roomName.trim(),
        visibility: 'private',
      });
      
      setRooms([...rooms, newRoom as Room]);
      setShowCreateModal(false);
      setRoomName('');
      setRoomType('group');
      
      router.push({
        pathname: '/(main)/chat/ChatScreen',
        params: { roomId: (newRoom as any).id },
      });
    } catch (error) {
      console.error('Error creating room:', error);
    } finally {
      setCreating(false);
    }
  };

  const openCreateModal = () => {
    setShowCreateModal(true);
    setRoomName('');
    setRoomType('group');
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
    setRoomName('');
    setRoomType('group');
    setShowTypeDropdown(false);
  };

  const handleRoomPress = async (room: Room) => {
    try {
      const isParticipant = (room as any).isParticipant === true;
      
      console.log(`[handleRoomPress] Room ${room.id}, isParticipant: ${isParticipant}, role: ${(room as any).role}`);
      
      if (!isParticipant) {
        console.log(`[handleRoomPress] User is not a participant, calling joinRoom...`);
        try {
          await roomApi.joinRoom(room.id);
          console.log(`✅ Joined room: ${room.id}`);
          
          const maxAttempts = 15;
          const pollInterval = 500;
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
        }
      }
      
      setCurrentRoom(room.id);
      router.push({
        pathname: '/(main)/chat/ChatScreen',
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
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <Text style={styles.headerTitle}>Rooms</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => router.push('/(main)/SearchScreen')}
          >
            <Ionicons name="search" size={22} color="#007AFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => router.push('/(main)/ProfileScreen')}
          >
            <Ionicons name="person" size={22} color="#007AFF" />
          </TouchableOpacity>
        </View>
      </View>

      <FlashList
        data={rooms}
        renderItem={({ item }) => (
          <RoomItem room={item} onPress={handleRoomPress} />
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
        <TouchableOpacity style={styles.createButton} onPress={openCreateModal}>
          <Text style={styles.createButtonText}>+ Create Room</Text>
        </TouchableOpacity>
      </View>

      <CreateRoomModal
        visible={showCreateModal}
        roomName={roomName}
        roomType={roomType}
        showTypeDropdown={showTypeDropdown}
        creating={creating}
        onRoomNameChange={setRoomName}
        onRoomTypeChange={setRoomType}
        onToggleDropdown={() => setShowTypeDropdown(!showTypeDropdown)}
        onClose={closeCreateModal}
        onSubmit={handleCreateRoom}
      />
    </View>
  );
}
