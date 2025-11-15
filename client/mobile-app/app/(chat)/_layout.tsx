import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { useAuthStore } from '../../store/authStore';

export default function ChatLayout() {
  const { isAuthenticated, isLoading } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inChatGroup = segments[0] === '(chat)';

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/(auth)/LoginScreen');
    } else if (isAuthenticated && inAuthGroup) {
      // Don't auto-redirect from chat - let user navigate back
    }
  }, [isAuthenticated, isLoading, segments]);

  return (
    <Stack screenOptions={{ headerShown: true }}>
      <Stack.Screen
        name="RoomListScreen"
        options={{ title: 'Rooms', headerShown: true }}
      />
      <Stack.Screen
        name="ChatScreen"
        options={{ title: 'Chat', headerShown: true }}
      />
    </Stack>
  );
}

