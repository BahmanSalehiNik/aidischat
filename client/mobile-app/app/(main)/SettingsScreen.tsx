import { View, Text, ScrollView, TouchableOpacity, SafeAreaView, Switch, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore, Theme } from '../../store/themeStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { settingsScreenStyles as styles } from '../../styles/settings/settingsScreenStyles';
import { SettingsHeader } from '../../components/settings/SettingsHeader';
import { SettingsSection } from '../../components/settings/SettingsSection';
import { SettingRow } from '../../components/settings/SettingRow';
import { ThemeOptions } from '../../components/settings/ThemeOptions';

export default function SettingsScreen() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { theme, setTheme } = useThemeStore();
  const insets = useSafeAreaInsets();

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
      <SettingsHeader topInset={Math.max(insets.top, 12)} onBack={() => router.back()} />

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
