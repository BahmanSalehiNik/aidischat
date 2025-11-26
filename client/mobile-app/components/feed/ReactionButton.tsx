import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ReactionType, reactionApi } from '../../utils/api';

interface ReactionButtonProps {
  postId?: string;
  commentId?: string;
  currentReaction?: ReactionType | null;
  onReactionChange?: (type: ReactionType | null) => void;
  iconName?: keyof typeof Ionicons.glyphMap;
  buttonLabel?: string;
}

const REACTION_TYPES: { type: ReactionType; emoji: string; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { type: 'like', emoji: '👍', label: 'Like', icon: 'thumbs-up' },
  { type: 'love', emoji: '❤️', label: 'Love', icon: 'heart' },
  { type: 'haha', emoji: '😂', label: 'Haha', icon: 'happy' },
  { type: 'sad', emoji: '😢', label: 'Sad', icon: 'sad' },
  { type: 'angry', emoji: '😠', label: 'Angry', icon: 'flash' },
];

export const ReactionButton: React.FC<ReactionButtonProps> = ({
  postId,
  commentId,
  currentReaction,
  onReactionChange,
  iconName,
  buttonLabel,
}) => {
  const [showPicker, setShowPicker] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedReaction, setSelectedReaction] = useState<ReactionType | null>(currentReaction ?? null);

  React.useEffect(() => {
    setSelectedReaction(currentReaction ?? null);
  }, [currentReaction]);

  const handleReactionPress = async (type: ReactionType) => {
    if (isLoading) return;

    const isRemoving = selectedReaction === type;
    const newReaction = isRemoving ? null : type;

    setIsLoading(true);
    setShowPicker(false);

    try {
      if (postId) {
        if (isRemoving) {
          await reactionApi.removePostReaction(postId);
        } else {
          await reactionApi.addPostReaction(postId, type);
        }
      } else if (commentId) {
        if (isRemoving) {
          await reactionApi.removeCommentReaction(commentId);
        } else {
          await reactionApi.addCommentReaction(commentId, type);
        }
      }
      setSelectedReaction(newReaction);
      onReactionChange?.(newReaction);
    } catch (error) {
      console.error('Error updating reaction:', error);
      // Revert on error
    } finally {
      setIsLoading(false);
    }
  };

  const getIcon = () => {
    if (selectedReaction) {
      const reaction = REACTION_TYPES.find(r => r.type === selectedReaction);
      return reaction?.icon || 'heart-outline';
    }
    return 'heart-outline';
  };

  const getColor = () => {
    if (selectedReaction === 'like') return '#007AFF';
    if (selectedReaction === 'love') return '#FF3040';
    return '#8E8E93';
  };

  return (
    <>
      <TouchableOpacity
        style={styles.container}
        onPress={() => setShowPicker(true)}
        onLongPress={() => {
          // Long press to quickly toggle like
          handleReactionPress('like');
        }}
        disabled={isLoading}
      >
        <Ionicons 
          name={(iconName || getIcon()) as any} 
          size={20} 
          color={getColor()} 
        />
        <Text style={[styles.label, { color: getColor() }]}>
          {buttonLabel ??
            (selectedReaction
            ? REACTION_TYPES.find(r => r.type === selectedReaction)?.label || 'React'
            : 'React')}
        </Text>
      </TouchableOpacity>

      <Modal
        visible={showPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPicker(false)}
      >
        <Pressable 
          style={styles.modalOverlay}
          onPress={() => setShowPicker(false)}
        >
          <View style={styles.pickerContainer}>
            {REACTION_TYPES.map((reaction) => (
              <TouchableOpacity
                key={reaction.type}
                style={[
                  styles.reactionOption,
                  selectedReaction === reaction.type && styles.reactionOptionActive,
                ]}
                onPress={() => handleReactionPress(reaction.type)}
              >
                <Text style={styles.reactionEmoji}>{reaction.emoji}</Text>
                <Text style={styles.reactionLabel}>{reaction.label}</Text>
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
    gap: 6,
  },
  label: {
    fontSize: 14,
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
    backgroundColor: '#FFFFFF',
    borderRadius: 30,
    padding: 8,
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  reactionOption: {
    padding: 8,
    borderRadius: 20,
    alignItems: 'center',
    minWidth: 50,
  },
  reactionOptionActive: {
    backgroundColor: '#F0F0F0',
  },
  reactionEmoji: {
    fontSize: 28,
    marginBottom: 4,
  },
  reactionLabel: {
    fontSize: 10,
    color: '#8E8E93',
  },
});

