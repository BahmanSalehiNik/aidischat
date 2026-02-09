import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, SafeAreaView, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Image } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '../../store/authStore';
import { agentPublicApi, agentsApi, mediaApi, postApi, profileApi } from '../../utils/api';
import { StorageContainers } from '../../utils/storageContainers';
import { PostCard, Post } from '../../components/feed/PostCard';

type EntityType = 'user' | 'agent';
type TabType = 'posts' | 'photos';

export default function EntityProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ entityType: EntityType; entityId: string }>();
  const { user } = useAuthStore();

  const entityType: EntityType = (params.entityType as EntityType) || 'user';
  const entityId = String(params.entityId || '');

  const [activeTab, setActiveTab] = useState<TabType>('posts');
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState<boolean>(true);
  const [reason, setReason] = useState<string | null>(null);

  const [userProfile, setUserProfile] = useState<any>(null);
  const [agentProfile, setAgentProfile] = useState<any>(null);
  const [agent, setAgent] = useState<any>(null);

  const [posts, setPosts] = useState<Post[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [photos, setPhotos] = useState<any[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [avatarSignedUrl, setAvatarSignedUrl] = useState<string | null>(null);

  const canEdit = useMemo(() => {
    if (!user?.id) return false;
    if (entityType === 'user') return user.id === entityId;
    // for agents, backend tells us via relationship.owner but we fallback to agent.ownerUserId
    return Boolean(agent?.ownerUserId && agent.ownerUserId === user.id);
  }, [user?.id, entityType, entityId, agent?.ownerUserId]);

  const userProfileId = useMemo(() => {
    const p = userProfile;
    return String(p?.id || p?._id || '');
  }, [userProfile]);

  const agentProfileId = useMemo(() => {
    // Prefer agent.agentProfileId (stable), fallback to agentProfile._id (lean response).
    const id = agent?.agentProfileId || agentProfile?.id || agentProfile?._id;
    return String(id || '');
  }, [agent?.agentProfileId, agentProfile]);

  const header = useMemo(() => {
    if (entityType === 'agent') {
      const name = agentProfile?.displayName || agentProfile?.name || 'Agent';
      const headline =
        agentProfile?.title ||
        agentProfile?.profession ||
        undefined;
      return {
        title: name,
        subtitle: headline || 'AI Agent',
        avatarUrl: avatarSignedUrl || agentProfile?.avatarUrl,
        coverUrl: undefined,
      };
    }
    const name = userProfile?.fullName || userProfile?.username || 'User';
    return {
      title: name,
      subtitle: userProfile?.username ? `@${userProfile.username}` : undefined,
      avatarUrl: avatarSignedUrl || userProfile?.profilePicture?.url,
      coverUrl: userProfile?.coverPhoto?.url,
    };
  }, [entityType, userProfile, agentProfile, avatarSignedUrl]);

  const aboutLines = useMemo(() => {
    if (entityType === 'agent') {
      const lines: string[] = [];
      if (agentProfile?.title) lines.push(String(agentProfile.title));
      if (agentProfile?.profession) lines.push(String(agentProfile.profession));
      if (agentProfile?.backstory) lines.push(String(agentProfile.backstory));
      return lines.filter(Boolean);
    }
    const lines: string[] = [];
    if (userProfile?.bio) lines.push(String(userProfile.bio));
    return lines.filter(Boolean);
  }, [entityType, agentProfile, userProfile]);

  const loadProfile = useCallback(async () => {
    if (!entityId) return;
    setLoading(true);
    setReason(null);
    try {
      if (entityType === 'user') {
        const res = await profileApi.getUserProfileView(entityId);
        setAllowed(Boolean(res.allowed ?? true));
        setUserProfile(res.profile || res);
      } else {
        const res = await agentPublicApi.getAgentProfileView(entityId);
        setAllowed(Boolean(res.allowed ?? true));
        setReason(res.reason || null);
        setAgent(res.agent || null);
        setAgentProfile(res.agentProfile || null);
      }
    } catch (err: any) {
      // If backend returns 403 with body, our api client may throw; treat as denied but show header if possible.
      const status = err?.status || err?.response?.status;
      const data = err?.data || err?.response?.data;
      if (status === 403 && data) {
        setAllowed(false);
        setReason(data.reason || 'forbidden');
        if (entityType === 'user') setUserProfile(data.profile || null);
        if (entityType === 'agent') setAgentProfile(data.agentProfile || null);
      } else {
        console.error('Failed to load profile:', err?.message || err);
        Alert.alert('Error', 'Failed to load profile');
      }
    } finally {
      setLoading(false);
    }
  }, [entityId, entityType]);

  const loadPosts = useCallback(async () => {
    if (!entityId) return;
    try {
      setLoadingPosts(true);
      const p = await postApi.getUserPosts(entityId);
      setPosts(Array.isArray(p) ? p : []);
    } finally {
      setLoadingPosts(false);
    }
  }, [entityId]);

  const loadPhotos = useCallback(async () => {
    if (!entityId) return;
    try {
      setLoadingPhotos(true);
      const list = await mediaApi.listByOwner(entityId, 'profile', { limit: 60, expiresSeconds: 60 * 60 * 6 });
      setPhotos(Array.isArray(list) ? list : []);
    } catch (err: any) {
      // If forbidden, just show empty to avoid a harsh UX.
      setPhotos([]);
    } finally {
      setLoadingPhotos(false);
    }
  }, [entityId]);

  const loadAvatar = useCallback(async () => {
    if (!entityId) return;
    try {
      // Prefer explicit avatar media if present (agent edit screen uses profile:avatar)
      const primaryType = entityType === 'agent' ? 'profile:avatar' : 'profile';
      const primary = await mediaApi.listByOwner(entityId, primaryType, { limit: 1, expiresSeconds: 60 * 60 * 6 });
      const firstPrimary = Array.isArray(primary) && primary.length ? primary[0] : null;

      // Fallback: if agent doesn't have an explicit avatar media record, use latest profile photo.
      const fallback =
        entityType === 'agent' && !firstPrimary
          ? await mediaApi.listByOwner(entityId, 'profile', { limit: 1, expiresSeconds: 60 * 60 * 6 })
          : null;
      const firstFallback = Array.isArray(fallback) && fallback?.length ? fallback[0] : null;

      const candidate = firstPrimary || firstFallback;
      const url = candidate?.downloadUrl || candidate?.url || null;
      setAvatarSignedUrl(url ? String(url) : null);
    } catch {
      setAvatarSignedUrl(null);
    }
  }, [entityId, entityType]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  // When navigating back from edit screens, refresh avatar/profile so the header updates immediately.
  useFocusEffect(
    useCallback(() => {
      if (!entityId) return;
      // Load profile (agentProfile/avatarUrl fields) and also reload the signed avatar media record.
      loadProfile();
      loadAvatar();
    }, [entityId, allowed, loadProfile, loadAvatar])
  );

  useEffect(() => {
    if (!allowed) return;
    loadAvatar();
    if (activeTab === 'posts') loadPosts();
    if (activeTab === 'photos') loadPhotos();
  }, [allowed, activeTab, loadAvatar, loadPosts, loadPhotos]);

  const pickAndUploadPhotos = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'We need access to your photos to upload images.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.85,
      allowsEditing: false,
    });

    if (result.canceled || !result.assets?.length) return;

    try {
      let lastStorageUrl: string | null = null;
      for (const asset of result.assets as any[]) {
        const mimeType = asset.mimeType && asset.mimeType !== 'unknown' ? asset.mimeType : 'image/jpeg';
        const filename = asset.fileName || `profile_${Date.now()}.jpg`;

        const upload = await mediaApi.getUploadUrl(
          StorageContainers.Profile,
          mimeType,
          filename,
          entityType === 'agent' ? entityId : undefined
        );

        const fileResponse = await fetch(asset.uri);
        const blob = await fileResponse.blob();

        await mediaApi.uploadFile(upload.uploadUrl, asset.uri, mimeType, upload.provider);
        const storageUrl = upload.uploadUrl.split('?')[0];
        lastStorageUrl = storageUrl;

        await mediaApi.createMedia({
          provider: upload.provider,
          bucket: upload.container,
          key: upload.key,
          url: storageUrl,
          type: 'image',
          size: blob.size || 1,
          ownerId: entityType === 'agent' ? entityId : undefined,
          relatedResource: { type: 'profile', id: entityId },
        });
      }

      // Treat uploaded photos as "profile photo" for the owner for a straightforward UX.
      // (This updates the avatar/cover sources used by the profile header.)
      if (canEdit && lastStorageUrl) {
        if (entityType === 'user' && userProfileId) {
          await profileApi.updateProfile(userProfileId, {
            profilePicture: { url: lastStorageUrl },
          });
          await loadProfile();
        }
        if (entityType === 'agent' && agentProfileId) {
          // Important: Don't overwrite an explicitly chosen avatar with an arbitrary uploaded photo.
          // Only use the last uploaded photo as a fallback avatar if no explicit avatar exists.
          let hasExplicitAvatar = false;
          try {
            const avatarMedia = await mediaApi.listByOwner(entityId, 'profile:avatar', { limit: 1, expiresSeconds: 60 * 60 * 6 });
            hasExplicitAvatar = Array.isArray(avatarMedia) && avatarMedia.length > 0;
          } catch {
            // ignore and treat as missing
          }

          if (!hasExplicitAvatar) {
            await agentsApi.updateProfile(agentProfileId, {
              avatarUrl: lastStorageUrl,
            });
            await loadProfile();
          }
        }
      }

      await loadPhotos();
      setActiveTab('photos');
    } catch (err: any) {
      const msg = String(err?.message || '');
      console.error('Upload failed:', msg || err);
      if (msg.includes('401')) {
        Alert.alert(
          'Not authorized',
          'Upload was rejected by the media service (401). Please log out and log back in. If you recently changed JWT secrets in Kubernetes, restart the media service pods so all services share the same JWT_DEV.'
        );
      } else {
        Alert.alert('Error', 'Failed to upload photo(s)');
      }
    }
  }, [entityId, entityType, canEdit, userProfileId, agentProfileId, loadPhotos, loadProfile]);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
        <View style={{ paddingTop: Math.max(insets.top, 12), paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#E5E5EA', flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 16 }}>
            <Ionicons name="arrow-back" size={24} color="#000000" />
          </TouchableOpacity>
          <Text style={{ fontSize: 18, fontWeight: '600', color: '#000000', flex: 1 }}>Profile</Text>
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
        <Text style={{ fontSize: 18, fontWeight: '600', color: '#000000', flex: 1 }}>Profile</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }}>
        {/* Cover */}
        <View style={{ height: 140, backgroundColor: '#F2F2F7' }}>
          {header.coverUrl ? (
            <Image source={{ uri: header.coverUrl }} style={{ width: '100%', height: '100%' }} />
          ) : null}
        </View>

        {/* Avatar + header */}
        <View style={{ paddingHorizontal: 16, marginTop: -40 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: '#FFFFFF', padding: 4 }}>
              <View style={{ width: '100%', height: '100%', borderRadius: 48, backgroundColor: '#F2F2F7', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
                {header.avatarUrl ? (
                  <Image source={{ uri: header.avatarUrl }} style={{ width: '100%', height: '100%' }} />
                ) : (
                  <Ionicons name={entityType === 'agent' ? 'sparkles' : 'person'} size={38} color="#8E8E93" />
                )}
              </View>
            </View>

            {canEdit ? (
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity
                  onPress={() => {
                    if (entityType === 'user') router.push('/(main)/EditUserProfileScreen');
                    else {
                      if (!agentProfileId) {
                        Alert.alert('Error', 'Agent profile is not ready yet. Please try again in a moment.');
                        return;
                      }
                      router.push({
                        pathname: '/(main)/EditAgentProfileScreen',
                        params: { agentId: entityId, profileId: agentProfileId },
                      });
                    }
                  }}
                  style={{ backgroundColor: '#F2F2F7', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}
                >
                  <Ionicons name="create-outline" size={18} color="#000000" />
                  <Text style={{ color: '#000000', fontWeight: '700' }}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={pickAndUploadPhotos}
                  style={{ backgroundColor: '#007AFF', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}
                >
                  <Ionicons name="camera" size={18} color="#FFFFFF" />
                  <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>Add Photo</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>

          <View style={{ marginTop: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={{ fontSize: 22, fontWeight: '800', color: '#000000', flexShrink: 1 }}>{header.title}</Text>
              {entityType === 'agent' ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#E3F2FD', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 }}>
                  <Ionicons name="sparkles" size={14} color="#1976D2" />
                  <Text style={{ marginLeft: 6, fontSize: 12, fontWeight: '700', color: '#1976D2' }}>Agent</Text>
                </View>
              ) : null}
            </View>
            {header.subtitle ? (
              <Text style={{ marginTop: 4, color: '#8E8E93' }}>{header.subtitle}</Text>
            ) : null}

            {aboutLines.length ? (
              <View style={{ marginTop: 10, gap: 6 }}>
                {aboutLines.slice(0, 3).map((line, idx) => (
                  <Text
                    key={`${entityType}:about:${idx}`}
                    style={{ color: '#000000', lineHeight: 20 }}
                    numberOfLines={idx === 2 ? 5 : 2}
                  >
                    {line}
                  </Text>
                ))}
              </View>
            ) : null}
          </View>
        </View>

        {/* Access denied */}
        {!allowed ? (
          <View style={{ paddingHorizontal: 16, paddingTop: 18 }}>
            <View style={{ backgroundColor: '#F2F2F7', borderRadius: 12, padding: 14 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#000000' }}>
                {reason === 'not_friends' ? 'Friends only' : 'Private'}
              </Text>
              <Text style={{ marginTop: 6, color: '#3C3C43' }}>
                {reason === 'not_friends'
                  ? 'You need to be friends to view this profile.'
                  : 'This profile is private.'}
              </Text>
            </View>
          </View>
        ) : (
          <>
            {/* Tabs */}
            <View style={{ paddingHorizontal: 16, paddingTop: 18, flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                onPress={() => setActiveTab('posts')}
                style={{
                  flex: 1,
                  borderRadius: 12,
                  paddingVertical: 10,
                  alignItems: 'center',
                  backgroundColor: activeTab === 'posts' ? '#E0ECFF' : '#F2F2F7',
                }}
              >
                <Text style={{ fontWeight: '700', color: activeTab === 'posts' ? '#007AFF' : '#3C3C43' }}>Posts</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setActiveTab('photos')}
                style={{
                  flex: 1,
                  borderRadius: 12,
                  paddingVertical: 10,
                  alignItems: 'center',
                  backgroundColor: activeTab === 'photos' ? '#E0ECFF' : '#F2F2F7',
                }}
              >
                <Text style={{ fontWeight: '700', color: activeTab === 'photos' ? '#007AFF' : '#3C3C43' }}>Photos</Text>
              </TouchableOpacity>
            </View>

            {/* Tab content */}
            {activeTab === 'posts' ? (
              <View style={{ paddingTop: 12 }}>
                {loadingPosts ? (
                  <View style={{ paddingTop: 40, alignItems: 'center' }}>
                    <ActivityIndicator size="large" color="#007AFF" />
                  </View>
                ) : posts.length === 0 ? (
                  <View style={{ paddingTop: 28, alignItems: 'center' }}>
                    <Ionicons name="grid-outline" size={56} color="#C7C7CC" />
                    <Text style={{ marginTop: 10, color: '#8E8E93' }}>No posts yet</Text>
                  </View>
                ) : (
                  posts.map((p) => <PostCard key={p.id} post={p} />)
                )}
              </View>
            ) : (
              <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
                {loadingPhotos ? (
                  <View style={{ paddingTop: 40, alignItems: 'center' }}>
                    <ActivityIndicator size="large" color="#007AFF" />
                  </View>
                ) : photos.length === 0 ? (
                  <View style={{ paddingTop: 28, alignItems: 'center' }}>
                    <Ionicons name="images-outline" size={56} color="#C7C7CC" />
                    <Text style={{ marginTop: 10, color: '#8E8E93' }}>No photos yet</Text>
                  </View>
                ) : (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {photos.slice(0, 60).map((m: any, idx: number) => (
                      <View
                        key={String(m?.id || m?._id || m?.key || m?.url || `photo:${idx}`)}
                        style={{ width: '31.5%', aspectRatio: 1, backgroundColor: '#F2F2F7', borderRadius: 8, overflow: 'hidden' }}
                      >
                        <Image source={{ uri: String(m?.downloadUrl || m?.url || '') }} style={{ width: '100%', height: '100%' }} />
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}



