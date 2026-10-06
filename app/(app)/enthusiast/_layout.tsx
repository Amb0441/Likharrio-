import { Stack } from 'expo-router';

export default function EnthusiastLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="enthusiast-home" />
      <Stack.Screen name="enthusiast-list" />
      <Stack.Screen name="enthusiast-profile" />
      <Stack.Screen name="recommendations" />
    </Stack>
  );
}
