import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  ScrollView,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../../store/authStore';
import { useChatStore } from '../../../store/chatStore';
import { roomApi, debugApi } from '../../../utils/api';
import { Room } from '../../../store/chatStore';
import { useGlobalWebSocket } from '../../../hooks/useGlobalWebSocket';

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
  const roomNameInputRef = useRef<TextInput>(null);
  const router = useRouter();
  const insets = useSafeAreaInsets();

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
    if (!roomName.trim()) {
      return; // Don't create if name is empty
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
      
      // Navigate immediately - the retry mechanism in ChatScreen will handle the race condition
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
            onPress={() => router.push('/(main)/ProfileScreen')}
          >
            <Ionicons name="person" size={22} color="#007AFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => router.push('/(main)/SearchScreen')}
          >
            <Ionicons name="search" size={22} color="#007AFF" />
          </TouchableOpacity>
        </View>
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
        <TouchableOpacity style={styles.createButton} onPress={openCreateModal}>
          <Text style={styles.createButtonText}>+ Create Room</Text>
        </TouchableOpacity>
      </View>

      {/* Create Room Modal */}
      <Modal
        visible={showCreateModal}
        transparent={true}
        animationType="slide"
        onRequestClose={closeCreateModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={closeCreateModal}
          />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create New Room</Text>
              <TouchableOpacity onPress={closeCreateModal}>
                <Ionicons name="close" size={24} color="#000000" />
              </TouchableOpacity>
            </View>

            <ScrollView 
              style={styles.modalBodyScroll}
              contentContainerStyle={styles.modalBody}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Room Name</Text>
                <TextInput
                  ref={roomNameInputRef}
                  style={styles.textInput}
                  placeholder="Enter room name"
                  placeholderTextColor="#999"
                  value={roomName}
                  onChangeText={setRoomName}
                  autoFocus
                  onFocus={() => {
                    // Close dropdown if open when focusing on input
                    if (showTypeDropdown) {
                      setShowTypeDropdown(false);
                    }
                  }}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Room Type</Text>
                <TouchableOpacity
                  style={styles.dropdownButton}
                  onPress={() => {
                    // Dismiss keyboard when opening dropdown
                    Keyboard.dismiss();
                    setShowTypeDropdown(!showTypeDropdown);
                  }}
                >
                  <Text style={styles.dropdownButtonText}>
                    {roomType === 'group' ? 'Group' : 'Direct'}
                  </Text>
                  <Ionicons
                    name={showTypeDropdown ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color="#666"
                  />
                </TouchableOpacity>
                {showTypeDropdown && (
                  <View style={styles.dropdownOptions}>
                    <TouchableOpacity
                      style={[
                        styles.dropdownOption,
                        roomType === 'group' && styles.dropdownOptionSelected,
                      ]}
                      onPress={() => {
                        setRoomType('group');
                        setShowTypeDropdown(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.dropdownOptionText,
                          roomType === 'group' && styles.dropdownOptionTextSelected,
                        ]}
                      >
                        Group
                      </Text>
                      {roomType === 'group' && (
                        <Ionicons name="checkmark" size={20} color="#007AFF" />
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.dropdownOption,
                        roomType === 'direct' && styles.dropdownOptionSelected,
                      ]}
                      onPress={() => {
                        setRoomType('direct');
                        setShowTypeDropdown(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.dropdownOptionText,
                          roomType === 'direct' && styles.dropdownOptionTextSelected,
                        ]}
                      >
                        Direct
                      </Text>
                      {roomType === 'direct' && (
                        <Ionicons name="checkmark" size={20} color="#007AFF" />
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={closeCreateModal}
                disabled={creating}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.createModalButton,
                  (!roomName.trim() || creating) && styles.createModalButtonDisabled,
                ]}
                onPress={handleCreateRoom}
                disabled={!roomName.trim() || creating}
              >
                {creating ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.createModalButtonText}>Create</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000000',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerButton: {
    padding: 8,
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
  // Modal Styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
  },
  modalBodyScroll: {
    flexShrink: 1,
    maxHeight: 400,
  },
  modalBody: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#000000',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  dropdownButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  dropdownButtonText: {
    fontSize: 16,
    color: '#000000',
  },
  dropdownOptions: {
    marginTop: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
  },
  dropdownOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  dropdownOptionSelected: {
    backgroundColor: '#F2F2F7',
  },
  dropdownOptionText: {
    fontSize: 16,
    color: '#000000',
  },
  dropdownOptionTextSelected: {
    color: '#007AFF',
    fontWeight: '600',
  },
  modalFooter: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
    backgroundColor: '#FFFFFF',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#F2F2F7',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  createModalButton: {
    backgroundColor: '#007AFF',
  },
  createModalButtonDisabled: {
    backgroundColor: '#C0C0C0',
  },
  createModalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

