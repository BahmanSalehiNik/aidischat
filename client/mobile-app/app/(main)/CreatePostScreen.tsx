import { View, Text, ScrollView, TouchableOpacity, SafeAreaView, TextInput, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { postApi, mediaApi } from '../../utils/api';
import { StorageContainers } from '../../utils/storageContainers';
import { createPostScreenStyles as styles } from '../../styles/createPost/createPostScreenStyles';
import { CreatePostHeader } from '../../components/createPost/CreatePostHeader';
import { VisibilityPicker, VisibilityOption } from '../../components/createPost/VisibilityPicker';
import { MediaSelector, SelectedImage } from '../../components/createPost/MediaSelector';

type Visibility = 'public' | 'friends' | 'private';

export default function CreatePostScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [content, setContent] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('public');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);

  const visibilityOptions: VisibilityOption[] = [
    { label: 'Public', value: 'public', icon: 'globe-outline' },
    { label: 'Friends', value: 'friends', icon: 'people-outline' },
    { label: 'Private', value: 'private', icon: 'lock-closed-outline' },
  ];

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'We need access to your photos to upload images.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets) {
      const newImages = result.assets.map((asset: any) => {
        // Ensure we have a valid MIME type
        let mimeType = asset.mimeType;
        if (!mimeType || mimeType === 'unknown') {
          // Default to jpeg if mimeType is missing or unknown
          mimeType = 'image/jpeg';
        }
        return {
          uri: asset.uri,
          type: mimeType,
          name: asset.fileName || `image_${Date.now()}.jpg`,
        };
      });
      setSelectedImages([...selectedImages, ...newImages]);
    }
  };

  const removeImage = (index: number) => {
    setSelectedImages(selectedImages.filter((_, i) => i !== index));
  };

  const uploadImages = async (): Promise<string[]> => {
    if (selectedImages.length === 0) return [];

    setUploadingImages(true);
    const mediaIds: string[] = [];

    try {
      for (const image of selectedImages) {
        // Validate image type before proceeding
        if (!image.type || image.type === 'unknown') {
          throw new Error(`Invalid image type for ${image.name || 'image'}. Please try selecting the image again.`);
        }

        // Step 1: Get upload URL
        console.log('📤 Requesting upload URL:', {
          container: StorageContainers.Posts,
          contentType: image.type,
          filename: image.name,
        });
        const uploadUrlResponse = await mediaApi.getUploadUrl(
          StorageContainers.Posts, // container name
          image.type,
          image.name
        );
        console.log('✅ Upload URL received:', uploadUrlResponse);

        const { uploadUrl, provider, container, key } = uploadUrlResponse;

        // Step 2: Get file size before uploading
        const fileResponse = await fetch(image.uri);
        const fileBlob = await fileResponse.blob();
        const fileSize = fileBlob.size;

        // Step 3: Upload to storage
        await mediaApi.uploadFile(uploadUrl, image.uri, image.type, provider);

        // Step 4: Construct the storage URL (remove query params to get base URL)
        const storageUrl = uploadUrl.split('?')[0];

        // Step 5: Register media with media service
        const mediaResponse = await mediaApi.createMedia({
          provider,
          bucket: container,
          key,
          url: storageUrl,
          type: 'image',
          size: fileSize,
        });

        mediaIds.push(mediaResponse.id);
      }
    } catch (error: any) {
      console.error('Error uploading images:', error);
      // Extract more detailed error message if available
      let errorMessage = 'Failed to upload images. Please try again.';
      if (error?.message) {
        errorMessage = error.message;
      } else if (error?.errors && Array.isArray(error.errors) && error.errors.length > 0) {
        // Handle validation errors from backend
        const validationErrors = error.errors.map((e: any) => e.message || e.field).join(', ');
        errorMessage = `Validation error: ${validationErrors}`;
      }
      throw new Error(errorMessage);
    } finally {
      setUploadingImages(false);
    }

    return mediaIds;
  };

  const handleSubmit = async () => {
    if (!content.trim() && selectedImages.length === 0) {
      Alert.alert('Error', 'Please enter some content or add a photo.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Upload images first
      const mediaIds = await uploadImages();

      // Create post with media IDs
      await postApi.createPost({
        content: content.trim(),
        visibility,
        mediaIds: mediaIds.length > 0 ? mediaIds : undefined,
      });
      
      Alert.alert('Success', 'Post created successfully!', [
        {
          text: 'OK',
          onPress: () => {
            setContent('');
            setSelectedImages([]);
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

  return (
    <SafeAreaView style={styles.container}>
      <CreatePostHeader
        topInset={Math.max(insets.top, 12)}
        onBack={() => router.back()}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        disabled={!content.trim() && selectedImages.length === 0}
      />

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
        <VisibilityPicker
          value={visibility}
          options={visibilityOptions}
          disabled={isSubmitting}
          onChange={(value) => setVisibility(value as Visibility)}
        />

        {/* Media Section */}
        <MediaSelector
          images={selectedImages}
          onAdd={pickImage}
          onRemove={removeImage}
          disabled={isSubmitting}
          uploading={uploadingImages}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
