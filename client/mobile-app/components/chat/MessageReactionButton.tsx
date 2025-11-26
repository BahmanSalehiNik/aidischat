import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface MessageReactionButtonProps {
  messageId: string;
  roomId: string;
  currentReaction?: string | null; // emoji string
  reactionsSummary?: Array<{ emoji: string; count: number }>;
  onReactionChange?: (emoji: string | null) => void;
}

const REACTION_EMOJIS = ['👍', '❤️', '😂', '😢', '😠'];

export const MessageReactionButton: React.FC<MessageReactionButtonProps> = ({
  messageId,
  roomId,
  currentReaction,
  reactionsSummary = [],
  onReactionChange,
}) => {
  const [showPicker, setShowPicker] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedReaction, setSelectedReaction] = useState<string | null>(currentReaction ?? null);

  React.useEffect(() => {
    setSelectedReaction(currentReaction ?? null);
  }, [currentReaction]);

  const handleReactionPress = async (emoji: string) => {
    if (isLoading) return;

    // Check if this is the current user's reaction - if so, remove it; otherwise, add/change it
    const isRemoving = currentReaction === emoji;
    const newReaction = isRemoving ? null : emoji;

    setIsLoading(true);
    setShowPicker(false);

    try {
      // Send reaction via WebSocket (will be handled by useWebSocket hook)
      onReactionChange?.(newReaction);
    } catch (error) {
      console.error('Error updating reaction:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePress = () => {
    if (!isLoading) {
      setShowPicker(true);
    }
  };

  const handleBadgePress = (emoji: string) => {
    // Toggle reaction when clicking on a badge
    handleReactionPress(emoji);
  };

  // Don't render anything if there are no reactions
  if (reactionsSummary.length === 0) {
    return null;
  }

  return (
    <>
      <View style={styles.container}>
        {/* Show reaction badges */}
        <View style={styles.reactionBadges}>
          {reactionsSummary.map((reaction, index) => (
            <TouchableOpacity
              key={`${reaction.emoji}-${index}`}
              style={[
                styles.reactionBadge,
                currentReaction === reaction.emoji && styles.reactionBadgeActive
              ]}
              onPress={() => handleBadgePress(reaction.emoji)}
              disabled={isLoading}
            >
              <Text style={styles.reactionEmoji}>{reaction.emoji}</Text>
              {reaction.count > 1 && (
                <Text style={styles.reactionCount}>{reaction.count}</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <Modal
        visible={showPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPicker(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowPicker(false)}>
          <View style={styles.pickerContainer}>
            {REACTION_EMOJIS.map((emoji) => (
              <TouchableOpacity
                key={emoji}
                style={[
                  styles.emojiButton,
                  selectedReaction === emoji && styles.emojiButtonSelected,
                ]}
                onPress={() => handleReactionPress(emoji)}
              >
                <Text style={styles.emojiText}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2, // Smaller gap between badges
  },
  reactionBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2, // Smaller gap between badges
  },
  reactionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 5, // Increased from 4
    paddingVertical: 3, // Increased from 2
    minHeight: 24, // Increased from 20
    // Shadow/elevation to make it look like a sticker
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
    borderWidth: 0.5,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  reactionBadgeActive: {
    backgroundColor: '#E3F2FD',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  reactionEmoji: {
    fontSize: 14, // Increased from 12
  },
  reactionCount: {
    fontSize: 11, // Increased from 10
    color: '#666',
    marginLeft: 2,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  emojiButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    marginHorizontal: 4,
  },
  emojiButtonSelected: {
    backgroundColor: '#E3F2FD',
  },
  emojiText: {
    fontSize: 24,
  },
});

