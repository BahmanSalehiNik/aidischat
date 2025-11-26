import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { commentApi } from '../../utils/api';

interface CommentInputProps {
  postId: string;
  parentCommentId?: string;
  placeholder?: string;
  onCommentAdded?: () => void;
}

export const CommentInput: React.FC<CommentInputProps> = ({
  postId,
  parentCommentId,
  placeholder = 'Write a comment...',
  onCommentAdded,
}) => {
  const [text, setText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!text.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await commentApi.createComment(postId, text.trim(), parentCommentId);
      setText('');
      onCommentAdded?.();
    } catch (error) {
      console.error('Error creating comment:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor="#8E8E93"
        value={text}
        onChangeText={setText}
        multiline
        maxLength={1000}
        editable={!isSubmitting}
      />
      <TouchableOpacity
        style={[styles.sendButton, (!text.trim() || isSubmitting) && styles.sendButtonDisabled]}
        onPress={handleSubmit}
        disabled={!text.trim() || isSubmitting}
      >
        {isSubmitting ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Ionicons name="send" size={20} color="#FFFFFF" />
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5EA',
    gap: 8,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#F2F2F7',
    borderRadius: 20,
    fontSize: 15,
    color: '#000000',
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#C7C7CC',
  },
});

