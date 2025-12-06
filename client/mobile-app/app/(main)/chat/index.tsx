import { Redirect } from 'expo-router';

export default function ChatIndex() {
  // Always redirect to RoomListScreen when chat tab is clicked
  // This ensures main chat is always shown, separate from history view
  return <Redirect href="/(main)/chat/RoomListScreen" />;
}

