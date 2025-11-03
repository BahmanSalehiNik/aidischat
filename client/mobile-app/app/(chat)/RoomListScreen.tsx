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
import { roomApi } from '../../utils/api';
import { Room } from '../../store/chatStore';

export default function RoomListScreen() {
  const { user, logout } = useAuthStore();
  const { rooms, setRooms, setCurrentRoom } = useChatStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  useEffect(() => {
    loadRooms();
  }, []);

  const loadRooms = async () => {
    try {
      setLoading(true);
      const roomsData = await roomApi.getUserRooms();
      setRooms(roomsData as Room[]);
    } catch (error) {
      console.error('Error loading rooms:', error);
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
      router.push({
        pathname: '/(chat)/ChatScreen',
        params: { roomId: (newRoom as any).id },
      });
    } catch (error) {
      console.error('Error creating room:', error);
    }
  };

  const handleRoomPress = (room: Room) => {
    setCurrentRoom(room.id);
    router.push({
      pathname: '/(chat)/ChatScreen',
      params: { roomId: room.id },
    });
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
        estimatedItemSize={80}
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

