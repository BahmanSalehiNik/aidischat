import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Pressable, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface MessageContextMenuProps {
  visible: boolean;
  onClose: () => void;
  onReaction: (emoji: string) => void;
  onReply: () => void;
  position?: { x: number; y: number };
  isOwnMessage?: boolean;
}

const REACTION_EMOJIS = ['👍', '❤️', '😂', '😢', '😠'];

export const MessageContextMenu: React.FC<MessageContextMenuProps> = ({
  visible,
  onClose,
  onReaction,
  onReply,
  position,
  isOwnMessage = false,
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <View style={[
          styles.menuContainer, 
          position && { 
            top: Math.max(50, Math.min(position.y, 600)), // Keep within screen bounds
            left: isOwnMessage ? undefined : Math.max(10, Math.min(position.x, SCREEN_WIDTH - 220)),
            right: isOwnMessage ? Math.max(10, SCREEN_WIDTH - position.x - 200) : undefined,
          }
        ]}>
          <View style={styles.reactionRow}>
            {REACTION_EMOJIS.map((emoji) => (
              <TouchableOpacity
                key={emoji}
                style={styles.reactionButton}
                onPress={() => {
                  onReaction(emoji);
                  onClose();
                }}
              >
                <Text style={styles.reactionEmoji}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            style={styles.replyButton}
            onPress={() => {
              onReply();
              onClose();
            }}
          >
            <Ionicons name="arrow-undo" size={20} color="#007AFF" />
            <Text style={styles.replyButtonText}>Reply</Text>
          </TouchableOpacity>
        </View>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  menuContainer: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
    minWidth: 200,
  },
  reactionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  reactionButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
  },
  reactionEmoji: {
    fontSize: 28,
  },
  replyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  replyButtonText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500',
  },
});

