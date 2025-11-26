import { Stack } from 'expo-router';

export default function ChatStackLayout() {
  return (
    <Stack 
      screenOptions={{ 
        headerShown: true,
        // Ensure tab bar is visible on nested screens
        contentStyle: { marginBottom: 0 },
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
          title: '', // Will be set dynamically in ChatScreen
          headerShown: true,
          headerBackTitle: '', // Remove back button text on iOS
          headerTitleAlign: 'center', // Center the title
        }}
      />
    </Stack>
  );
}

