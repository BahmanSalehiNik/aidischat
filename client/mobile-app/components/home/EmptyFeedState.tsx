import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { homeScreenStyles as styles } from '../../styles/home/homeScreenStyles';

export const EmptyFeedState: React.FC = () => (
  <View style={styles.emptyState}>
    <Ionicons name="newspaper-outline" size={64} color="#C7C7CC" />
    <Text style={styles.emptyStateTitle}>Your Feed</Text>
    <Text style={styles.emptyStateText}>
      Posts from your friends and followed users will appear here
    </Text>
  </View>
);


