import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { createPostScreenStyles as styles } from '../../styles/createPost/createPostScreenStyles';

export interface SelectedImage {
  uri: string;
  type: string;
  name?: string;
}

interface MediaSelectorProps {
  images: SelectedImage[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  disabled?: boolean;
  uploading?: boolean;
}

export const MediaSelector: React.FC<MediaSelectorProps> = ({
  images,
  onAdd,
  onRemove,
  disabled = false,
  uploading = false,
}) => {
  return (
    <View style={styles.mediaSection}>
      <Text style={styles.sectionLabel}>Media</Text>
      <TouchableOpacity
        style={styles.mediaButton}
        onPress={onAdd}
        disabled={disabled || uploading}
      >
        <Ionicons name="image-outline" size={24} color="#007AFF" />
        <Text style={styles.mediaButtonText}>
          {uploading ? 'Uploading...' : 'Add Photo'}
        </Text>
      </TouchableOpacity>

      {images.length > 0 && (
        <View style={styles.selectedImagesContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {images.map((image, index) => (
              <View key={`${image.uri}-${index}`} style={styles.imagePreview}>
                <ExpoImage
                  source={{ uri: image.uri }}
                  style={styles.previewImage}
                  contentFit="cover"
                />
                <TouchableOpacity
                  style={styles.removeImageButton}
                  onPress={() => onRemove(index)}
                  disabled={disabled}
                >
                  <Ionicons name="close-circle" size={24} color="#FF3B30" />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
};


