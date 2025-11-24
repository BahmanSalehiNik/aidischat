import { ScrollView, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { notificationsScreenStyles as styles } from '../../styles/notifications/notificationsScreenStyles';
import { NotificationsHeader } from '../../components/notifications/NotificationsHeader';
import { EmptyNotifications } from '../../components/notifications/EmptyNotifications';

export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={styles.container}>
      <NotificationsHeader
        topInset={Math.max(insets.top, 12)}
        onCreatePost={() => router.push('/(main)/CreatePostScreen')}
        onSearch={() => router.push('/(main)/SearchScreen')}
        onProfile={() => router.push('/(main)/ProfileScreen')}
      />

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <EmptyNotifications />
      </ScrollView>
    </SafeAreaView>
  );
}