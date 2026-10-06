import { Stack } from 'expo-router';

export default function ArtistLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="artist-home" />
      <Stack.Screen name="artist-profile" />
      <Stack.Screen name="allartist" />
      <Stack.Screen name="artist-profile-view" />
      <Stack.Screen name="artist-verification" />
    </Stack>
  );
}
