import { useRouter } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StatusBar, StyleSheet, Text, View } from 'react-native';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import LikharrioLogo from '../../components/ui/LikharrioLogo';
import { withTimeout, SlowNetworkError } from '../../utils/withTimeout';

export default function Home() {
  const { user, isGuestMode } = useAuth();
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [slowNetwork, setSlowNetwork] = useState(false);

  useEffect(() => {
    checkUserRoleAndNavigate();
  }, [user, isGuestMode]);

  const checkUserRoleAndNavigate = async () => {
    setSlowNetwork(false);

    if (!user) {
      if (isGuestMode) {
        router.replace('/(app)/enthusiast/enthusiast-home' as any);
        return;
      }
      router.replace('/(auth)/welcome');
      return;
    }

    // Show "slow network" hint after 5 s if still waiting
    const slowTimer = setTimeout(() => setSlowNetwork(true), 5000);

    try {
      const userDocSnap = await withTimeout(getDoc(doc(db, 'users', user.uid)));
      clearTimeout(slowTimer);

      if (!userDocSnap.exists()) { router.replace('/(auth)/role-selection'); return; }
      const userData = userDocSnap.data();
      if (!userData.role) { router.replace('/(auth)/role-selection'); return; }
      if (userData.role === 'admin') router.replace('/(app)/admin' as any);
      else if (userData.role === 'artist') router.replace('/(app)/artist/artist-home' as any);
      else if (userData.role === 'enthusiast') router.replace('/(app)/enthusiast/enthusiast-home' as any);
      else router.replace('/(auth)/role-selection');
    } catch (err) {
      clearTimeout(slowTimer);
      if (err instanceof SlowNetworkError) {
        Alert.alert(
          'Slow Connection',
          'It\'s taking longer than expected. Please check your internet connection and try again.',
          [{ text: 'Retry', onPress: () => checkUserRoleAndNavigate() }]
        );
      } else {
        router.replace('/(auth)/role-selection');
      }
    } finally {
      setChecking(false);
      setSlowNetwork(false);
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />
      <View style={styles.bgBase} />
      <View style={styles.bgMid} />
      <LikharrioLogo size={80} variant="dark" showWordmark={true} showTagline={false} />
      <View style={styles.loadingRow}>
        <ActivityIndicator size="small" color="rgba(201,168,76,0.8)" />
        <Text style={styles.loadingText}>Loading…</Text>
      </View>
      {slowNetwork && (
        <Text style={styles.slowText}>Slow connection detected…</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1, backgroundColor: '#1A0505',
    justifyContent: 'center', alignItems: 'center', gap: 24,
  },
  bgBase: { ...StyleSheet.absoluteFillObject, backgroundColor: '#1A0505' },
  bgMid: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: '45%',
    backgroundColor: '#3D0E0E', opacity: 0.7, borderTopLeftRadius: 300,
  },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  loadingText: { fontSize: 14, color: 'rgba(250,243,232,0.5)', fontWeight: '500' },
  slowText: {
    fontSize: 12,
    color: 'rgba(201,168,76,0.65)',
    fontWeight: '400',
    letterSpacing: 0.3,
    marginTop: -12,
  },
});
