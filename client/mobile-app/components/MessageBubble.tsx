import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAuthStore } from '../store/authStore';
import { Message } from '../store/chatStore';

interface MessageBubbleProps {
  message: Message;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const { user } = useAuthStore();
  const isOwnMessage = message.senderId === user?.id;

  return (
    <View
      style={[
        styles.container,
        isOwnMessage ? styles.ownMessage : styles.otherMessage,
      ]}
    >
      {!isOwnMessage && (
        <Text style={styles.senderName}>
          {message.senderType === 'agent' 
            ? `🤖 ${message.senderName || 'Agent'}` 
            : (message.senderName || message.sender?.name || `User ${message.senderId?.slice(0, 8) || 'Unknown'}`)
          }
        </Text>
      )}
      <Text style={[styles.content, isOwnMessage && styles.ownContent]}>
        {message.content}
      </Text>
      <Text style={[styles.timestamp, isOwnMessage && styles.ownTimestamp]}>
        {new Date(message.createdAt).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    maxWidth: '75%',
    padding: 12,
    borderRadius: 16,
    marginVertical: 4,
    marginHorizontal: 12,
  },
  ownMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#007AFF',
    borderBottomRightRadius: 4,
  },
  otherMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#E5E5EA',
    borderBottomLeftRadius: 4,
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  content: {
    fontSize: 16,
    color: '#000',
    lineHeight: 20,
  },
  ownContent: {
    color: '#FFF',
  },
  timestamp: {
    fontSize: 11,
    color: '#666',
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  ownTimestamp: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
});

