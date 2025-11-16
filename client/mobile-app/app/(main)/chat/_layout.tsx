import { Stack } from 'expo-router';

export default function ChatStackLayout() {
  return (
    <Stack 
      screenOptions={{ 
        headerShown: true,
        // Ensure tab bar is visible on nested screens
        contentStyle: { marginBottom: 0 },
        initialRouteName: 'RoomListScreen',
      }}
    >
      <Stack.Screen
        name="RoomListScreen"
        options={{ 
          title: 'Rooms', 
          headerShown: false, // Use custom header in RoomListScreen
        }}
      />
      <Stack.Screen
        name="ChatScreen"
        options={{ 
          title: 'Chat', 
          headerShown: true,
        }}
      />
    </Stack>
  );
}

