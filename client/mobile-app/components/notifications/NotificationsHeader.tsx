import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { notificationsScreenStyles as styles } from '../../styles/notifications/notificationsScreenStyles';

interface NotificationsHeaderProps {
  topInset: number;
  onCreatePost: () => void;
  onSearch: () => void;
  onProfile: () => void;
}

export const NotificationsHeader: React.FC<NotificationsHeaderProps> = ({
  topInset,
  onCreatePost,
  onSearch,
  onProfile,
}) => (
  <View style={[styles.header, { paddingTop: topInset }]}>
    <Text style={styles.headerTitle}>Notifications</Text>
    <View style={styles.headerButtons}>
      <TouchableOpacity style={styles.headerButton} onPress={onCreatePost}>
        <Ionicons name="add-circle" size={22} color="#007AFF" />
      </TouchableOpacity>
      <TouchableOpacity style={styles.headerButton} onPress={onSearch}>
        <Ionicons name="search" size={22} color="#007AFF" />
      </TouchableOpacity>
      <TouchableOpacity style={styles.headerButton} onPress={onProfile}>
        <Ionicons name="person" size={22} color="#007AFF" />
      </TouchableOpacity>
    </View>
  </View>
);


