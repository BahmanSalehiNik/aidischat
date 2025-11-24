import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { setupBannerStyles as styles } from './styles/setupBannerStyles';

export const SetupBanner: React.FC = () => {
  return (
    <View style={styles.setupBanner}>
      <ActivityIndicator size="small" color="#007AFF" style={{ marginRight: 8 }} />
      <Text style={styles.setupText}>Setting up the room...</Text>
    </View>
  );
};

