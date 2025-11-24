import React from 'react';
import { View, TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createPostScreenStyles as styles } from '../../styles/createPost/createPostScreenStyles';

interface CreatePostHeaderProps {
  title?: string;
  topInset: number;
  onBack: () => void;
  onSubmit: () => void;
  isSubmitting?: boolean;
  disabled?: boolean;
}

export const CreatePostHeader: React.FC<CreatePostHeaderProps> = ({
  title = 'Create Post',
  topInset,
  onBack,
  onSubmit,
  isSubmitting = false,
  disabled = false,
}) => {
  const buttonDisabled = disabled || isSubmitting;

  return (
    <View style={[styles.header, { paddingTop: topInset }]}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={onBack}
        disabled={isSubmitting}
      >
        <Ionicons name="arrow-back" size={24} color="#000000" />
      </TouchableOpacity>

      <Text style={styles.headerTitle}>{title}</Text>

      <TouchableOpacity
        style={[styles.postButton, buttonDisabled && styles.postButtonDisabled]}
        onPress={onSubmit}
        disabled={buttonDisabled}
      >
        {isSubmitting ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Text style={styles.postButtonText}>Post</Text>
        )}
      </TouchableOpacity>
    </View>
  );
};


