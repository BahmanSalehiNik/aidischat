import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, SafeAreaView, TouchableOpacity, ActivityIndicator, Alert, TextInput, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/authStore';
import { profileApi } from '../../utils/api';

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

  const canSave = useMemo(() => {
    return Boolean(username.trim() && fullName.trim());
  }, [username, fullName]);

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
    } catch (err: any) {
      console.error('Failed to load profile for editing:', err?.message || err);
      Alert.alert('Error', 'Failed to load profile');
      router.back();
    } finally {
      setLoading(false);
    }
  }, [router, user?.id]);

  useEffect(() => {
    load();
  }, [load]);

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


