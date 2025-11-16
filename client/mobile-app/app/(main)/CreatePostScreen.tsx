import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState } from 'react';
import { postApi } from '../../utils/api';

type Visibility = 'public' | 'friends' | 'private';

export default function CreatePostScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [content, setContent] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('public');
  const [showVisibilityDropdown, setShowVisibilityDropdown] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const visibilityOptions: { label: string; value: Visibility; icon: string }[] = [
    { label: 'Public', value: 'public', icon: 'globe-outline' },
    { label: 'Friends', value: 'friends', icon: 'people-outline' },
    { label: 'Private', value: 'private', icon: 'lock-closed-outline' },
  ];

  const handleSubmit = async () => {
    if (!content.trim()) {
      Alert.alert('Error', 'Please enter some content for your post.');
      return;
    }

    setIsSubmitting(true);
    try {
      await postApi.createPost({
        content: content.trim(),
        visibility,
      });
      
      Alert.alert('Success', 'Post created successfully!', [
        {
          text: 'OK',
          onPress: () => {
            setContent('');
            router.back();
          },
        },
      ]);
    } catch (error: any) {
      console.error('Error creating post:', error);
      Alert.alert(
        'Error',
        error?.message || 'Failed to create post. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedVisibility = visibilityOptions.find(opt => opt.value === visibility);

  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          disabled={isSubmitting}
        >
          <Ionicons name="arrow-back" size={24} color="#000000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Post</Text>
        <TouchableOpacity
          style={[styles.postButton, (!content.trim() || isSubmitting) && styles.postButtonDisabled]}
          onPress={handleSubmit}
          disabled={!content.trim() || isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.postButtonText}>Post</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Content Input */}
        <View style={styles.inputSection}>
          <TextInput
            style={styles.textInput}
            placeholder="What's on your mind?"
            placeholderTextColor="#8E8E93"
            value={content}
            onChangeText={setContent}
            multiline
            maxLength={5000}
            textAlignVertical="top"
            editable={!isSubmitting}
          />
          <Text style={styles.characterCount}>
            {content.length} / 5000
          </Text>
        </View>

        {/* Visibility Selector */}
        <View style={styles.visibilitySection}>
          <Text style={styles.sectionLabel}>Visibility</Text>
          <TouchableOpacity
            style={styles.visibilityButton}
            onPress={() => setShowVisibilityDropdown(!showVisibilityDropdown)}
            disabled={isSubmitting}
          >
            <View style={styles.visibilityButtonContent}>
              <Ionicons name={selectedVisibility?.icon as any} size={20} color="#007AFF" />
              <Text style={styles.visibilityButtonText}>{selectedVisibility?.label}</Text>
            </View>
            <Ionicons
              name={showVisibilityDropdown ? 'chevron-up' : 'chevron-down'}
              size={20}
              color="#8E8E93"
            />
          </TouchableOpacity>

          {showVisibilityDropdown && (
            <View style={styles.visibilityDropdown}>
              {visibilityOptions.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.visibilityOption,
                    visibility === option.value && styles.visibilityOptionActive
                  ]}
                  onPress={() => {
                    setVisibility(option.value);
                    setShowVisibilityDropdown(false);
                  }}
                >
                  <Ionicons
                    name={option.icon as any}
                    size={20}
                    color={visibility === option.value ? '#007AFF' : '#8E8E93'}
                  />
                  <Text
                    style={[
                      styles.visibilityOptionText,
                      visibility === option.value && styles.visibilityOptionTextActive
                    ]}
                  >
                    {option.label}
                  </Text>
                  {visibility === option.value && (
                    <Ionicons name="checkmark" size={20} color="#007AFF" style={styles.checkIcon} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Media Section (Placeholder for future implementation) */}
        <View style={styles.mediaSection}>
          <Text style={styles.sectionLabel}>Media</Text>
          <TouchableOpacity
            style={styles.mediaButton}
            onPress={() => {
              Alert.alert('Coming Soon', 'Media upload will be available soon.');
            }}
            disabled={isSubmitting}
          >
            <Ionicons name="image-outline" size={24} color="#007AFF" />
            <Text style={styles.mediaButtonText}>Add Photo or Video</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
  },
  postButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postButtonDisabled: {
    backgroundColor: '#C7C7CC',
  },
  postButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  inputSection: {
    marginBottom: 24,
  },
  textInput: {
    fontSize: 16,
    color: '#000000',
    minHeight: 150,
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  characterCount: {
    fontSize: 12,
    color: '#8E8E93',
    textAlign: 'right',
    marginTop: 8,
  },
  visibilitySection: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 12,
  },
  visibilityButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  visibilityButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  visibilityButtonText: {
    fontSize: 16,
    color: '#000000',
    fontWeight: '500',
  },
  visibilityDropdown: {
    marginTop: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    overflow: 'hidden',
  },
  visibilityOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  visibilityOptionActive: {
    backgroundColor: '#F2F2F7',
  },
  visibilityOptionText: {
    flex: 1,
    fontSize: 16,
    color: '#8E8E93',
  },
  visibilityOptionTextActive: {
    color: '#007AFF',
    fontWeight: '500',
  },
  checkIcon: {
    marginLeft: 'auto',
  },
  mediaSection: {
    marginBottom: 24,
  },
  mediaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderStyle: 'dashed',
  },
  mediaButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500',
  },
});
