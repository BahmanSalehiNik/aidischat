import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, SafeAreaView, TouchableOpacity, ActivityIndicator, Alert, TextInput, ScrollView, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { agentPublicApi, agentsApi, mediaApi } from '../../utils/api';
import { StorageContainers } from '../../utils/storageContainers';

export default function EditAgentProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ agentId: string; profileId: string }>();

  const agentId = String(params.agentId || '');
  const profileId = String(params.profileId || '');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [title, setTitle] = useState('');
  const [profession, setProfession] = useState('');
  const [backstory, setBackstory] = useState('');
  // avatarStorageUrl: raw blob URL stored in agent profile (not directly renderable if blob is private)
  // avatarDisplayUrl: signed URL used for <Image /> rendering
  const [avatarStorageUrl, setAvatarStorageUrl] = useState<string | undefined>(undefined);
  const [avatarDisplayUrl, setAvatarDisplayUrl] = useState<string | undefined>(undefined);

  const canSave = useMemo(() => Boolean(profileId && (name.trim() || displayName.trim())), [profileId, name, displayName]);

  const loadAvatarDisplay = useCallback(async (canonicalAvatarUrl?: string | null) => {
    if (!agentId) return;
    try {
      // If profile explicitly has no avatarUrl, respect it and show placeholder (even if old avatar media exists).
      const canonical = canonicalAvatarUrl !== undefined ? canonicalAvatarUrl : avatarStorageUrl;
      if (!canonical) {
        setAvatarDisplayUrl(undefined);
        return;
      }
      // Prefer explicit avatar media if present, else fallback to latest profile photo
      const primary = await mediaApi.listByOwner(agentId, 'profile:avatar', { limit: 1, expiresSeconds: 60 * 60 * 6 });
      const firstPrimary = Array.isArray(primary) && primary.length ? primary[0] : null;
      const fallback =
        !firstPrimary
          ? await mediaApi.listByOwner(agentId, 'profile', { limit: 1, expiresSeconds: 60 * 60 * 6 })
          : null;
      const firstFallback = Array.isArray(fallback) && fallback?.length ? fallback[0] : null;
      const candidate = firstPrimary || firstFallback;
      const url = candidate?.downloadUrl || candidate?.url;
      setAvatarDisplayUrl(url ? String(url) : undefined);
    } catch {
      setAvatarDisplayUrl(undefined);
    }
  }, [agentId, avatarStorageUrl]);

  const load = useCallback(async () => {
    if (!agentId) {
      Alert.alert('Error', 'Missing agentId');
      router.back();
      return;
    }
    if (!profileId) {
      Alert.alert('Error', 'Missing profileId');
      router.back();
      return;
    }
    setLoading(true);
    try {
      const res = await agentPublicApi.getAgentProfileView(agentId);
      const ap = (res as any)?.agentProfile || null;
      setName(String(ap?.name || ''));
      setDisplayName(String(ap?.displayName || ''));
      setTitle(String(ap?.title || ''));
      setProfession(String(ap?.profession || ''));
      setBackstory(String(ap?.backstory || ''));
      const canonicalAvatar = ap?.avatarUrl ? String(ap.avatarUrl) : undefined;
      setAvatarStorageUrl(canonicalAvatar);
      // Ensure we show the avatar immediately and consistently (signed URL from media service)
      await loadAvatarDisplay(canonicalAvatar);
    } catch (err: any) {
      console.error('Failed to load agent profile:', err?.message || err);
      Alert.alert('Error', 'Failed to load agent profile');
      router.back();
    } finally {
      setLoading(false);
    }
  }, [agentId, profileId, router, loadAvatarDisplay]);

  useEffect(() => {
    load();
  }, [load]);

  const pickAndUploadAvatar = useCallback(async () => {
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
      const filename = asset.fileName || `agent_avatar_${Date.now()}.jpg`;

      const upload = await mediaApi.getUploadUrl(StorageContainers.Profile, mimeType, filename, agentId);
      const fileResponse = await fetch(asset.uri);
      const blob = await fileResponse.blob();

      await mediaApi.uploadFile(upload.uploadUrl, asset.uri, mimeType, upload.provider);
      const storageUrl = upload.uploadUrl.split('?')[0];

      // Register media (for Photos tab / audit)
      await mediaApi.createMedia({
        provider: upload.provider,
        bucket: upload.container,
        key: upload.key,
        url: storageUrl,
        type: 'image',
        size: blob.size || 1,
        ownerId: agentId,
        relatedResource: { type: 'profile:avatar', id: agentId },
      });

      // Update agent profile avatarUrl (used in headers/cards)
      await agentsApi.updateProfile(profileId, { avatarUrl: storageUrl });
      setAvatarStorageUrl(storageUrl);
      await loadAvatarDisplay(storageUrl);
      Alert.alert('Updated', 'Agent avatar updated.');
    } catch (err: any) {
      const msg = String(err?.message || '');
      console.error('Avatar upload failed:', msg || err);
      if (msg.includes('401')) {
        Alert.alert(
          'Not authorized',
          'Upload was rejected by the media service (401). Please log out and log back in. If JWT secrets were changed, restart the media service pods so all services share the same JWT_DEV.'
        );
      } else {
        Alert.alert('Error', msg || 'Failed to upload avatar');
      }
    }
  }, [agentId, profileId, loadAvatarDisplay]);

  const removeAvatar = useCallback(async () => {
    if (!profileId) return;
    Alert.alert('Remove avatar?', 'This will remove the agent icon photo. You can set it again anytime.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            setSaving(true);
            // Clear avatarUrl in agent profile; all screens will respect this and show placeholder.
            await agentsApi.updateProfile(profileId, { avatarUrl: null });
            setAvatarStorageUrl(undefined);
            setAvatarDisplayUrl(undefined);
            Alert.alert('Updated', 'Agent avatar removed.');
          } catch (err: any) {
            Alert.alert('Error', err?.message || 'Failed to remove avatar');
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  }, [profileId]);

  const onSave = useCallback(async () => {
    if (!canSave) {
      Alert.alert('Missing info', 'Please provide at least a name or display name.');
      return;
    }
    setSaving(true);
    try {
      await agentsApi.updateProfile(profileId, {
        name: name.trim() || undefined,
        displayName: displayName.trim() || undefined,
        title: title.trim() || undefined,
        profession: profession.trim() || undefined,
        backstory: backstory.trim() || undefined,
      });
      Alert.alert('Saved', 'Agent profile updated.');
      router.back();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to save agent profile');
    } finally {
      setSaving(false);
    }
  }, [canSave, profileId, name, displayName, title, profession, backstory, router]);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
        <View style={{ paddingTop: Math.max(insets.top, 12), paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#E5E5EA', flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 16 }}>
            <Ionicons name="arrow-back" size={24} color="#000000" />
          </TouchableOpacity>
          <Text style={{ fontSize: 18, fontWeight: '600', color: '#000000', flex: 1 }}>Edit Agent</Text>
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
        <Text style={{ fontSize: 18, fontWeight: '600', color: '#000000', flex: 1 }}>Edit Agent</Text>
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
                <Ionicons name="sparkles" size={44} color="#8E8E93" />
              )}
            </View>
            <Text style={{ marginTop: 10, color: '#007AFF', fontWeight: '700' }}>Change avatar</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={removeAvatar} disabled={saving} style={{ marginTop: 10 }}>
            <Text style={{ color: saving ? '#C7C7CC' : '#FF3B30', fontWeight: '700' }}>No photo (remove)</Text>
          </TouchableOpacity>
        </View>

        <View>
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#3C3C43' }}>Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Agent name"
            style={{ marginTop: 6, borderWidth: 1, borderColor: '#E5E5EA', borderRadius: 12, padding: 12, fontSize: 16 }}
          />
        </View>

        <View>
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#3C3C43' }}>Display name</Text>
          <TextInput
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="What others will see"
            style={{ marginTop: 6, borderWidth: 1, borderColor: '#E5E5EA', borderRadius: 12, padding: 12, fontSize: 16 }}
          />
        </View>

        <View>
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#3C3C43' }}>Headline</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="e.g., AI Research Assistant"
            style={{ marginTop: 6, borderWidth: 1, borderColor: '#E5E5EA', borderRadius: 12, padding: 12, fontSize: 16 }}
          />
        </View>

        <View>
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#3C3C43' }}>Profession</Text>
          <TextInput
            value={profession}
            onChangeText={setProfession}
            placeholder="e.g., Product Manager"
            style={{ marginTop: 6, borderWidth: 1, borderColor: '#E5E5EA', borderRadius: 12, padding: 12, fontSize: 16 }}
          />
        </View>

        <View>
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#3C3C43' }}>Bio / Backstory</Text>
          <TextInput
            value={backstory}
            onChangeText={setBackstory}
            placeholder="Describe your agent"
            multiline
            maxLength={2000}
            style={{ marginTop: 6, borderWidth: 1, borderColor: '#E5E5EA', borderRadius: 12, padding: 12, fontSize: 16, minHeight: 140, textAlignVertical: 'top' }}
          />
          <Text style={{ marginTop: 6, color: '#8E8E93', fontSize: 12 }}>{backstory.length}/2000</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}


