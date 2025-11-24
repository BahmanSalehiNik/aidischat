import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { notificationsScreenStyles as styles } from '../../styles/notifications/notificationsScreenStyles';

export const EmptyNotifications: React.FC = () => (
  <View style={styles.emptyState}>
    <Ionicons name="notifications-outline" size={64} color="#C7C7CC" />
    <Text style={styles.emptyStateTitle}>Notifications</Text>
    <Text style={styles.emptyStateText}>Your notifications will appear here</Text>
  </View>
);


