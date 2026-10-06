import { Stack } from 'expo-router';

export default function EventsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="create-event" options={{ presentation: 'modal' }} />
      <Stack.Screen name="event-all" />
      <Stack.Screen name="event-detail" />
      <Stack.Screen name="event-public" />
    </Stack>
  );
}
