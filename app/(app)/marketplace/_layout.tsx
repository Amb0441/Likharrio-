import { Stack } from 'expo-router';

export default function MarketplaceLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="artist-marketplace" />
      <Stack.Screen name="enthusiast-marketplace" />
      <Stack.Screen name="listing-details" />
      <Stack.Screen name="listing-items" options={{ presentation: 'modal' }} />
      <Stack.Screen name="edit-listing" />
    </Stack>
  );
}
