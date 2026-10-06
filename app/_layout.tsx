import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Platform } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "../contexts/AuthContext";
import { queryClient } from "../lib/queryClient";
import { InAppNotificationProvider } from "../contexts/InAppNotificationContext";
import NotificationListenerMount from "../components/NotificationListenerMount";
import AnimatedSplash from "../components/pwa/AnimatedSplash";
import InstallPrompt from "../components/pwa/InstallPrompt";
import COLORS from '../constants/Colors';

if (Platform.OS !== "web") {
  const Notifications = require("expo-notifications") as typeof import("expo-notifications");
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

// ── Account Suspended Screen ──────────────────────────────────────────────────
function AccountSuspendedScreen() {
  const { signOut } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.replace('/(auth)/welcome');
  };

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="dark" />
      <View style={styles.accentBar} />
      <View style={styles.inner}>

        <View style={styles.iconCircle}>
          <Text style={styles.iconEmoji}>🚫</Text>
        </View>

        <Text style={styles.title}>Account Suspended</Text>

        <Text style={styles.message}>
          This account is suspended for violating Likharrio's community guidelines.
          An administrator can restore it. If it was scheduled for deletion, you will be signed out.
        </Text>

        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

      </View>
    </SafeAreaView>
  );
}

// ── App Layout ────────────────────────────────────────────────────────────────
function AppLayout() {
  const { accountDeleted } = useAuth();

  return (
    <>
      {/* Stack is always mounted so its navigator is always available */}
      <InAppNotificationProvider>
        <NotificationListenerMount />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(app)" />
        </Stack>
      </InAppNotificationProvider>

      {/* Suspended screen overlays everything — no navigation needed from nested stacks */}
      {accountDeleted && (
        <View style={StyleSheet.absoluteFill}>
          <AccountSuspendedScreen />
        </View>
      )}
      <InstallPrompt />
    </>
  );
}

// ── Root Layout ───────────────────────────────────────────────────────────────
export default function RootLayout() {
  const [showSplash, setShowSplash] = useState(true);

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <StatusBar style={showSplash ? "light" : "auto"} />
        <AuthProvider>
          <AppLayout />
        </AuthProvider>
        {showSplash && <AnimatedSplash onFinish={() => setShowSplash(false)} />}
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background.primary,
  },
  accentBar: {
    height: 4,
    backgroundColor: COLORS.primary.deepRed,
  },
  inner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#FFF0F0',
    borderWidth: 1.5,
    borderColor: '#FFCCCC',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  iconEmoji: {
    fontSize: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.text.primary,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: COLORS.text.muted,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 300,
  },
  signOutBtn: {
    marginTop: 12,
    paddingVertical: 13,
    paddingHorizontal: 48,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.border.light,
  },
  signOutText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text.muted,
  },
});
