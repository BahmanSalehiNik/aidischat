import { Tabs, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';

export default function MainLayout() {
  const pathname = usePathname();
  
  // Hide tab bar when inside ChatScreen (but not RoomListScreen) or SettingsScreen
  const shouldHideTabBar = useMemo(() => {
    if (!pathname) return false;
    // Hide in ChatScreen (but not RoomListScreen)
    const isInChatScreen = pathname.includes('ChatScreen') && !pathname.includes('RoomListScreen');
    // Hide in SettingsScreen
    const isInSettingsScreen = pathname.includes('SettingsScreen');
    return isInChatScreen || isInSettingsScreen;
  }, [pathname]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: '#8E8E93',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#E5E5EA',
          display: shouldHideTabBar ? 'none' : 'flex',
        },
      }}
    >
      <Tabs.Screen
        name="HomeScreen"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="AgentsScreen"
        options={{
          title: 'Agents',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="sparkles" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="ChatScreen"
        options={{
          href: null, // Hide from tab bar - we'll use chat folder instead
        }}
      />
      <Tabs.Screen
        name="NotificationsScreen"
        options={{
          title: 'Notifications',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="notifications" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="ProfileScreen"
        options={{
          href: null, // Hide from tab bar, accessible via header button
        }}
      />
      <Tabs.Screen
        name="SearchScreen"
        options={{
          href: null, // Hide from tab bar, accessible via header button
        }}
      />
      <Tabs.Screen
        name="CreatePostScreen"
        options={{
          href: null, // Hide from tab bar, accessible via header button
        }}
      />
      <Tabs.Screen
        name="SettingsScreen"
        options={{
          href: null, // Hide from tab bar, accessible via profile settings button
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chat',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubbles" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

