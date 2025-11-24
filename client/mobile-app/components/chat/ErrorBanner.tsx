import React from 'react';
import { View, Text } from 'react-native';
import { errorBannerStyles as styles } from './styles/errorBannerStyles';

interface ErrorBannerProps {
  message: string;
  isConnected?: boolean;
}

export const ErrorBanner: React.FC<ErrorBannerProps> = ({ message, isConnected }) => {
  if (isConnected && message.includes('Connected')) {
    return null; // Don't show "Connected" message
  }
  
  return (
    <View style={styles.errorBanner}>
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
};

