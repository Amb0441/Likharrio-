import { Stack } from 'expo-router';

export default function ChatLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="detail" />
      <Stack.Screen name="group-chat" />
      <Stack.Screen name="group-artist" />
      <Stack.Screen name="group-enthusiast" />
    </Stack>
  );
}
