import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface QuotedMessageCardProps {
  message: {
    id: string;
    senderId: string;
    senderName?: string;
    senderType?: 'human' | 'agent';
    content: string;
    createdAt: string;
  };
  onPress?: () => void;
  variant?: 'preview' | 'inline'; // preview = above input, inline = in message bubble
  isOwnMessage?: boolean; // For styling when in own message bubble
}

export const QuotedMessageCard: React.FC<QuotedMessageCardProps> = ({
  message,
  onPress,
  variant = 'inline',
  isOwnMessage = false,
}) => {
  const isPreview = variant === 'preview';
  const displayName = message.senderName || 
    (message.senderType === 'agent' ? 'Agent' : `User ${message.senderId.slice(0, 8)}`);
  
  // Truncate content for preview
  const displayContent = isPreview && message.content.length > 50
    ? `${message.content.substring(0, 50)}...`
    : message.content;

  const content = (
    <View style={[
      styles.container, 
      isPreview && styles.previewContainer,
      isOwnMessage && styles.ownMessageContainer
    ]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {message.senderType === 'agent' && (
            <Text style={styles.agentIcon}>🤖</Text>
          )}
          <Text style={[styles.senderName, isOwnMessage && styles.ownSenderName]} numberOfLines={1}>
            {displayName}
          </Text>
        </View>
        {isPreview && (
          <TouchableOpacity onPress={onPress} style={styles.closeButton}>
            <Ionicons name="close" size={18} color="#666" />
          </TouchableOpacity>
        )}
      </View>
      <Text style={[styles.content, isOwnMessage && styles.ownContent]} numberOfLines={isPreview ? 2 : undefined}>
        {displayContent}
      </Text>
      {!isPreview && (
        <Text style={[styles.timestamp, isOwnMessage && styles.ownTimestamp]}>
          {new Date(message.createdAt).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
      )}
    </View>
  );

  if (onPress && !isPreview) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#007AFF',
  },
  previewContainer: {
    backgroundColor: '#E8F4FD',
    marginBottom: 0,
  },
  ownMessageContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderLeftColor: 'rgba(255, 255, 255, 0.5)',
  },
  ownSenderName: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  ownContent: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  ownTimestamp: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  agentIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#007AFF',
    flex: 1,
  },
  closeButton: {
    padding: 4,
  },
  content: {
    fontSize: 13,
    color: '#333',
    lineHeight: 18,
  },
  timestamp: {
    fontSize: 10,
    color: '#666',
    marginTop: 4,
  },
});

