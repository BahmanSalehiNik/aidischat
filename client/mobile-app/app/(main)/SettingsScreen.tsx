import { View, Text, ScrollView, TouchableOpacity, SafeAreaView, Alert, Image } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore, Theme } from '../../store/themeStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { settingsScreenStyles as styles } from '../../styles/settings/settingsScreenStyles';
import { SettingsHeader } from '../../components/settings/SettingsHeader';
import { SettingsSection } from '../../components/settings/SettingsSection';
import { SettingRow } from '../../components/settings/SettingRow';
import { ThemeOptions } from '../../components/settings/ThemeOptions';
import { mediaApi, profileApi } from '../../utils/api';
import { useCallback, useState } from 'react';

export default function SettingsScreen() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { theme, setTheme } = useThemeStore();
  const insets = useSafeAreaInsets();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const loadAvatar = useCallback(async () => {
    if (!user?.id) return;
    try {
      // Respect "no avatar": if profilePicture is cleared, show placeholder even if photos exist.
      const res = await profileApi.getUserProfileView(String(user.id));
      const p = (res as any)?.profile || res;
      const canonical = p?.profilePicture?.url;
      if (!canonical) {
        setAvatarUrl(null);
        return;
      }

      const list = await mediaApi.listByOwner(String(user.id), 'profile', { limit: 1, expiresSeconds: 60 * 60 * 6 });
      const first = Array.isArray(list) && list.length ? list[0] : null;
      const url = first?.downloadUrl || first?.url || null;
      setAvatarUrl(url ? String(url) : null);
    } catch {
      setAvatarUrl(null);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      loadAvatar();
    }, [loadAvatar])
  );

  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/(auth)/LoginScreen');
          },
        },
      ]
    );
  };

  const themeOptions: { label: string; value: Theme; icon: string }[] = [
    { label: 'Light', value: 'light', icon: 'sunny' },
    { label: 'Dark', value: 'dark', icon: 'moon' },
    { label: 'System', value: 'system', icon: 'phone-portrait' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <SettingsHeader
        topInset={Math.max(insets.top, 12)}
        onBack={() => router.back()}
        rightElement={
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => {
              if (!user?.id) return;
              router.push({
                pathname: '/(main)/EntityProfileScreen',
                params: { entityType: 'user', entityId: String(user.id) },
              });
            }}
            style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#F2F2F7', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}
          >
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={{ width: '100%', height: '100%' }} />
            ) : (
              <Ionicons name="person" size={18} color="#8E8E93" />
            )}
          </TouchableOpacity>
        }
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <SettingsSection title="Account">
          <SettingRow
            icon="create-outline"
            label="Edit Profile"
            onPress={() => router.push('/(main)/EditUserProfileScreen')}
            rightElement={<Ionicons name="chevron-forward" size={20} color="#C7C7CC" />}
          />
          <SettingRow
            icon="person-outline"
            label="Email"
            value={user?.email || 'Not available'}
          />
        </SettingsSection>

        <SettingsSection title="Appearance">
          <SettingRow icon="color-palette-outline" label="Theme" />
          <ThemeOptions
            options={themeOptions}
            value={theme}
            onChange={(value) => setTheme(value as Theme)}
          />
        </SettingsSection>

        <SettingsSection title="Privacy & Security">
          <SettingRow
            icon="lock-closed-outline"
            label="Privacy Settings"
            rightElement={<Ionicons name="chevron-forward" size={20} color="#C7C7CC" />}
          />
          <SettingRow
            icon="shield-checkmark-outline"
            label="Security"
            rightElement={<Ionicons name="chevron-forward" size={20} color="#C7C7CC" />}
          />
        </SettingsSection>

        <SettingsSection title="About">
          <SettingRow icon="information-circle-outline" label="App Version" value="1.0.0" />
          <SettingRow
            icon="document-text-outline"
            label="Terms of Service"
            rightElement={<Ionicons name="chevron-forward" size={20} color="#C7C7CC" />}
          />
          <SettingRow
            icon="shield-outline"
            label="Privacy Policy"
            rightElement={<Ionicons name="chevron-forward" size={20} color="#C7C7CC" />}
          />
        </SettingsSection>

        <SettingsSection title="">
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutButtonText}>Log Out</Text>
          </TouchableOpacity>
        </SettingsSection>

        <View style={styles.bottomSpacing} />
      </ScrollView>
    </SafeAreaView>
  );
}
