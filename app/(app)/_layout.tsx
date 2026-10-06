import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ArtistBottomNav from '../../components/navigation/ArtistBottomNav';
import EnthusiastBottomNav from '../../components/navigation/EnthusiastBottomNav';
import WebTopNav from '../../components/web/WebTopNav';
import { useAuth } from '../../contexts/AuthContext';
import { useLayoutMode } from '../../hooks/useLayoutMode';

export default function AppLayout() {
  const { user, userProfile, loading, isGuestMode, emailVerified } = useAuth();
  // Derive role directly from AuthContext — no extra Firestore fetch needed
  const userRole = isGuestMode
    ? 'enthusiast'
    : (userProfile?.role as 'artist' | 'enthusiast' | 'admin' | null) ?? null;
  const router = useRouter();
  const segments = useSegments();
  const { isWebsite } = useLayoutMode();

  // Handle redirects based on auth state
  useEffect(() => {
    if (loading) return;

    const inAuthGroup = (segments as string[]).includes('(auth)');

    if (!user && !isGuestMode && !inAuthGroup) {
      router.replace('/(auth)/welcome');
      return;
    }

    if (user && !isGuestMode && !emailVerified) {
      router.replace({
        pathname: '/(auth)/verify-email',
        params: { email: user.email ?? '' },
      } as any);
    }
  }, [user, segments, loading, isGuestMode, emailVerified]);

  // Auth still resolving
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#8B1A1A" />
      </View>
    );
  }

  // Email not verified — blank while redirect fires
  if (user && !isGuestMode && !emailVerified) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#8B1A1A" />
      </View>
    );
  }

  // Profile still loading from Firestore (AuthContext onSnapshot not yet fired)
  if (user && !isGuestMode && !userProfile) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#8B1A1A" />
        <Text style={styles.loadingHint}>Loading your profile…</Text>
      </View>
    );
  }

  // Authenticated but no role yet — let home.tsx handle redirect
  if (user && !isGuestMode && userProfile && !userRole) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#8B1A1A" />
      </View>
    );
  }

  const showRoleNav =
    (user || isGuestMode) && (userRole === 'artist' || userRole === 'enthusiast');
  const showAdminNav = userRole === 'admin';
  const hideMobileNav =
    (segments as string[]).includes('admin') ||
    (segments as string[]).includes('group-chat') ||
    (segments as string[]).includes('detail') ||
    (segments as string[]).includes('faq');

  return (
    <SafeAreaView style={[styles.container, !isWebsite && styles.mobileLock]} edges={isWebsite ? ['top'] : ['bottom']}>
      <View style={styles.body}>
        {isWebsite && (showRoleNav || showAdminNav) && userRole && (
          <WebTopNav role={userRole} />
        )}
        <View style={styles.main}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="home" />
            <Stack.Screen name="artist" />
            <Stack.Screen name="enthusiast" />
            <Stack.Screen name="chat" />
            <Stack.Screen name="marketplace" />
            <Stack.Screen name="events" />
            <Stack.Screen name="portfolio" />
            <Stack.Screen name="showcase" />
            <Stack.Screen name="notifications" />
            <Stack.Screen name="faq" />
            <Stack.Screen name="create-selection" />
            <Stack.Screen name="admin" />
          </Stack>
        </View>
      </View>

      {!isWebsite && showRoleNav && !hideMobileNav && (
        userRole === 'artist' ? <ArtistBottomNav /> : <EnthusiastBottomNav />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF7F2',
  },
  mobileLock: {
    width: '100%',
    maxWidth: '100%',
    overflow: 'hidden',
  },
  body: {
    flex: 1,
  },
  main: {
    flex: 1,
    backgroundColor: '#FAF7F2',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FAF7F2',
  },
  loadingHint: {
    fontSize: 13,
    color: '#8B7355',
    fontWeight: '500',
    marginTop: 4,
  },
});

