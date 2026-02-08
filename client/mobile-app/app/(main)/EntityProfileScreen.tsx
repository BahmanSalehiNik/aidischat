import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, SafeAreaView, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Image } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '../../store/authStore';
import { agentPublicApi, mediaApi, postApi, profileApi } from '../../utils/api';
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

  const canEdit = useMemo(() => {
    if (!user?.id) return false;
    if (entityType === 'user') return user.id === entityId;
    // for agents, backend tells us via relationship.owner but we fallback to agent.ownerUserId
    return Boolean(agent?.ownerUserId && agent.ownerUserId === user.id);
  }, [user?.id, entityType, entityId, agent?.ownerUserId]);

  const header = useMemo(() => {
    if (entityType === 'agent') {
      const name = agentProfile?.displayName || agentProfile?.name || 'Agent';
      return {
        title: name,
        subtitle: 'AI Agent',
        avatarUrl: agentProfile?.avatarUrl,
        coverUrl: undefined,
      };
    }
    const name = userProfile?.fullName || userProfile?.username || 'User';
    return {
      title: name,
      subtitle: userProfile?.username ? `@${userProfile.username}` : undefined,
      avatarUrl: userProfile?.profilePicture?.url,
      coverUrl: userProfile?.coverPhoto?.url,
    };
  }, [entityType, userProfile, agentProfile]);

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
      const list = await mediaApi.listByOwner(entityId, 'profile');
      setPhotos(Array.isArray(list) ? list : []);
    } catch (err: any) {
      // If forbidden, just show empty to avoid a harsh UX.
      setPhotos([]);
    } finally {
      setLoadingPhotos(false);
    }
  }, [entityId]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (!allowed) return;
    if (activeTab === 'posts') loadPosts();
    if (activeTab === 'photos') loadPhotos();
  }, [allowed, activeTab, loadPosts, loadPhotos]);

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

      await loadPhotos();
      setActiveTab('photos');
    } catch (err: any) {
      console.error('Upload failed:', err?.message || err);
      Alert.alert('Error', 'Failed to upload photo(s)');
    }
  }, [entityId, entityType, loadPhotos]);

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
              <TouchableOpacity
                onPress={pickAndUploadPhotos}
                style={{ backgroundColor: '#007AFF', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}
              >
                <Ionicons name="camera" size={18} color="#FFFFFF" />
                <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>Add Photo</Text>
              </TouchableOpacity>
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
                    {photos.slice(0, 60).map((m: any) => (
                      <View key={m.id} style={{ width: '31.5%', aspectRatio: 1, backgroundColor: '#F2F2F7', borderRadius: 8, overflow: 'hidden' }}>
                        <Image source={{ uri: m.url }} style={{ width: '100%', height: '100%' }} />
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


