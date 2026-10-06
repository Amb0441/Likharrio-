import { Stack, useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AdminNav from "../../../components/admin/AdminNav";
import COLORS from "../../../constants/Colors";
import { useAuth } from "../../../contexts/AuthContext";
import { useLayoutMode } from "../../../hooks/useLayoutMode";

export default function AdminLayout() {
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();
  const { isWebsite } = useLayoutMode();
  const isAdmin = userProfile?.role === "admin";

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/(auth)/welcome");
      return;
    }
    if (userProfile && userProfile.role !== "admin") {
      router.replace("/(app)/home");
    }
  }, [user, userProfile, loading]);

  if (loading || (user && !userProfile)) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={COLORS.primary.deepRed} />
      </View>
    );
  }

  if (!isAdmin) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={COLORS.primary.deepRed} />
        <Text style={styles.hint}>Checking access…</Text>
      </View>
    );
  }

  if (isWebsite) {
    return (
      <View style={styles.content}>
        <Stack screenOptions={{ headerShown: false }} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.frame}>
        <AdminNav wide={false} />
        <View style={styles.content}>
          <Stack screenOptions={{ headerShown: false }} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background.primary,
  },
  frame: {
    flex: 1,
  },
  content: {
    flex: 1,
    backgroundColor: COLORS.background.primary,
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.background.primary,
    gap: 10,
  },
  hint: {
    color: COLORS.text.muted,
    fontSize: 13,
  },
});
