import { Stack } from 'expo-router';

export default function ShowcaseLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="showcase-all" />
      <Stack.Screen name="showcase-detail" />
    </Stack>
  );
}
