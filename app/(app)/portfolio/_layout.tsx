import { Stack } from 'expo-router';

export default function PortfolioLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="create-portfolio" options={{ presentation: 'modal' }} />
      <Stack.Screen name="edit-portfolio" />
      <Stack.Screen name="portfolio-details" />
    </Stack>
  );
}
