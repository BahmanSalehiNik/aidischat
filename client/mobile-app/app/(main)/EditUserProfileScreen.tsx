import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, SafeAreaView, TouchableOpacity, ActivityIndicator, Alert, TextInput, ScrollView, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/authStore';
import * as ImagePicker from 'expo-image-picker';
import { mediaApi, profileApi } from '../../utils/api';
import { StorageContainers } from '../../utils/storageContainers';

export default function EditUserProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [profileId, setProfileId] = useState<string>('');
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarDisplayUrl, setAvatarDisplayUrl] = useState<string | undefined>(undefined);

  const canSave = useMemo(() => {
    return Boolean(username.trim() && fullName.trim());
  }, [username, fullName]);

  const loadAvatarDisplay = useCallback(async () => {
    if (!user?.id) return;
    try {
      const primary = await mediaApi.listByOwner(String(user.id), 'profile', { limit: 1, expiresSeconds: 60 * 60 * 6 });
      const first = Array.isArray(primary) && primary.length ? primary[0] : null;
      const url = first?.downloadUrl || first?.url;
      setAvatarDisplayUrl(url ? String(url) : undefined);
    } catch {
      setAvatarDisplayUrl(undefined);
    }
  }, [user?.id]);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const res = await profileApi.getUserProfileView(String(user.id));
      const p = (res as any)?.profile || res;
      const id = String(p?.id || p?._id || '');
      setProfileId(id);
      setUsername(String(p?.username || ''));
      setFullName(String(p?.fullName || ''));
      setBio(String(p?.bio || ''));
      // If user has explicitly cleared profilePicture, respect it and show "no avatar".
      const hasProfilePic = Boolean(p?.profilePicture?.url);
      if (hasProfilePic) {
        await loadAvatarDisplay();
      } else {
        setAvatarDisplayUrl(undefined);
      }
    } catch (err: any) {
      console.error('Failed to load profile for editing:', err?.message || err);
      Alert.alert('Error', 'Failed to load profile');
      router.back();
    } finally {
      setLoading(false);
    }
  }, [router, user?.id, loadAvatarDisplay]);

  useEffect(() => {
    load();
  }, [load]);

  const pickAndUploadAvatar = useCallback(async () => {
    if (!user?.id) return;
    if (!profileId) {
      Alert.alert('Error', 'Profile is not ready yet. Please try again in a moment.');
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'We need access to your photos to upload images.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled || !result.assets?.length) return;

    try {
      const asset: any = result.assets[0];
      const mimeType = asset.mimeType && asset.mimeType !== 'unknown' ? asset.mimeType : 'image/jpeg';
      const filename = asset.fileName || `profile_avatar_${Date.now()}.jpg`;

      const upload = await mediaApi.getUploadUrl(StorageContainers.Profile, mimeType, filename);
      const fileResponse = await fetch(asset.uri);
      const blob = await fileResponse.blob();

      await mediaApi.uploadFile(upload.uploadUrl, asset.uri, mimeType, upload.provider);
      const storageUrl = upload.uploadUrl.split('?')[0];

      // Register media (photos tab / audit)
      await mediaApi.createMedia({
        provider: upload.provider,
        bucket: upload.container,
        key: upload.key,
        url: storageUrl,
        type: 'image',
        size: blob.size || 1,
        relatedResource: { type: 'profile', id: String(user.id) },
      });

      // Set as current avatar in profile
      await profileApi.updateProfile(profileId, {
        profilePicture: { url: storageUrl },
      });

      await load();
      Alert.alert('Updated', 'Profile photo updated.');
    } catch (err: any) {
      const msg = String(err?.message || '');
      console.error('Avatar upload failed:', msg || err);
      if (msg.includes('401')) {
        Alert.alert('Not authorized', 'Upload was rejected by the media service (401). Please log out and log back in.');
      } else {
        Alert.alert('Error', msg || 'Failed to upload profile photo');
      }
    }
  }, [user?.id, profileId, load]);

  const removeAvatar = useCallback(async () => {
    if (!user?.id) return;
    if (!profileId) return;
    Alert.alert('Remove photo?', 'This will remove your profile icon photo. You can add it back anytime.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            setSaving(true);
            // Clear profilePicture; profile header will respect this and show placeholder.
            await profileApi.updateProfile(profileId, { profilePicture: null });
            await load();
          } catch (err: any) {
            Alert.alert('Error', err?.message || 'Failed to remove photo');
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  }, [user?.id, profileId, load]);

  const onSave = useCallback(async () => {
    if (!user?.id) return;
    if (!canSave) {
      Alert.alert('Missing info', 'Please enter both a username and full name.');
      return;
    }
    setSaving(true);
    try {
      if (profileId) {
        await profileApi.updateProfile(profileId, {
          username: username.trim(),
          fullName: fullName.trim(),
          bio: bio.trim() || undefined,
        });
      } else {
        const created = await profileApi.createProfile({
          username: username.trim(),
          fullName: fullName.trim(),
          bio: bio.trim() || undefined,
        });
        setProfileId(String(created?.id || created?._id || ''));
      }
      Alert.alert('Saved', 'Your profile has been updated.');
      router.back();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  }, [user?.id, canSave, profileId, username, fullName, bio, router]);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
        <View style={{ paddingTop: Math.max(insets.top, 12), paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#E5E5EA', flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 16 }}>
            <Ionicons name="arrow-back" size={24} color="#000000" />
          </TouchableOpacity>
          <Text style={{ fontSize: 18, fontWeight: '600', color: '#000000', flex: 1 }}>Edit Profile</Text>
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <View style={{ paddingTop: Math.max(insets.top, 12), paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#E5E5EA', flexDirection: 'row', alignItems: 'center' }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 16 }}>
          <Ionicons name="arrow-back" size={24} color="#000000" />
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: '600', color: '#000000', flex: 1 }}>Edit Profile</Text>
        <TouchableOpacity
          onPress={onSave}
          disabled={saving || !canSave}
          style={{
            backgroundColor: saving || !canSave ? '#C7C7CC' : '#007AFF',
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 10,
          }}
        >
          <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>{saving ? 'Saving…' : 'Save'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 12 }}>
        <View style={{ alignItems: 'center', marginBottom: 6 }}>
          <TouchableOpacity onPress={pickAndUploadAvatar} activeOpacity={0.8} style={{ alignItems: 'center' }}>
            <View style={{ width: 110, height: 110, borderRadius: 55, backgroundColor: '#F2F2F7', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
              {avatarDisplayUrl ? (
                <Image source={{ uri: avatarDisplayUrl }} style={{ width: '100%', height: '100%' }} />
              ) : (
                <Ionicons name="person" size={44} color="#8E8E93" />
              )}
            </View>
            <Text style={{ marginTop: 10, color: '#007AFF', fontWeight: '700' }}>Change avatar</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={removeAvatar} disabled={saving} style={{ marginTop: 10 }}>
            <Text style={{ color: saving ? '#C7C7CC' : '#FF3B30', fontWeight: '700' }}>No photo (remove)</Text>
          </TouchableOpacity>
        </View>

        <View>
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#3C3C43' }}>Username</Text>
          <TextInput
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            placeholder="your_username"
            style={{ marginTop: 6, borderWidth: 1, borderColor: '#E5E5EA', borderRadius: 12, padding: 12, fontSize: 16 }}
          />
        </View>

        <View>
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#3C3C43' }}>Full name</Text>
          <TextInput
            value={fullName}
            onChangeText={setFullName}
            placeholder="Your name"
            style={{ marginTop: 6, borderWidth: 1, borderColor: '#E5E5EA', borderRadius: 12, padding: 12, fontSize: 16 }}
          />
        </View>

        <View>
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#3C3C43' }}>Bio</Text>
          <TextInput
            value={bio}
            onChangeText={setBio}
            placeholder="Tell people about you"
            multiline
            maxLength={300}
            style={{ marginTop: 6, borderWidth: 1, borderColor: '#E5E5EA', borderRadius: 12, padding: 12, fontSize: 16, minHeight: 110, textAlignVertical: 'top' }}
          />
          <Text style={{ marginTop: 6, color: '#8E8E93', fontSize: 12 }}>{bio.length}/300</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}


