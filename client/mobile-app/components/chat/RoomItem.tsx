import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Room } from '../../store/chatStore';
import { roomItemStyles as styles } from './styles/roomItemStyles';

interface RoomItemProps {
  room: Room;
  onPress: (room: Room) => void;
}

export const RoomItem: React.FC<RoomItemProps> = ({ room, onPress }) => {
  return (
    <TouchableOpacity style={styles.roomItem} onPress={() => onPress(room)}>
      <View style={styles.roomContent}>
        <Text style={styles.roomName}>
          {room.name || `Room ${room.id.slice(0, 8)}`}
        </Text>
        <Text style={styles.roomType}>{room.type}</Text>
      </View>
      <Text style={styles.roomArrow}>→</Text>
    </TouchableOpacity>
  );
};

