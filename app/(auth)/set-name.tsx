import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, updateDoc } from "firebase/firestore";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth, db } from "../../lib/firebase";
import COLORS from "../../constants/Colors";
import { withTimeout, SlowNetworkError } from "../../utils/withTimeout";

export default function SetNameScreen() {
  const router = useRouter();
  const { role } = useLocalSearchParams<{ role: string }>();

  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const isArtist = role === "artist";

  // ── Save name ──
  const handleContinue = async () => {
    if (!name.trim()) {
      Alert.alert("Name Required", "Please enter your name to continue.");
      return;
    }
    if (name.trim().length < 2) {
      Alert.alert("Name Too Short", "Please enter at least 2 characters.");
      return;
    }
    const currentUser = auth.currentUser;
    if (!currentUser) {
      router.replace("/(auth)/login");
      return;
    }
    setLoading(true);
    try {
      await withTimeout(
        updateDoc(doc(db, "users", currentUser.uid), {
          name: name.trim(),
          displayName: name.trim(),
        })
      );
      if (isArtist) {
        router.replace("/(app)/artist/artist-verification" as any);
      } else {
        router.replace("/(app)/home");
      }
    } catch (e) {
      if (e instanceof SlowNetworkError) {
        Alert.alert(
          "Slow Connection",
          "Could not save your name — please check your internet and try again.",
          [{ text: "Retry", onPress: () => handleContinue() }]
        );
      } else {
        console.error("Error saving name:", e);
        Alert.alert("Error", "Could not save your name. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.content}>

          {/* Icon */}
          <View style={styles.iconOuter}>
            <View style={styles.iconCircle}>
              <Ionicons
                name={isArtist ? "brush" : "happy-outline"}
                size={52}
                color={COLORS.primary.deepRed}
              />
            </View>
            <View style={styles.ring} />
          </View>

          {/* Heading */}
          <Text style={styles.title}>What's your name?</Text>
          <Text style={styles.subtitle}>
            {isArtist
              ? "This is how fellow enthusiasts will know you as an artist."
              : "This is how the Likharrio community will see you."}
          </Text>

          {/* Role badge */}
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>
              {isArtist ? "🎨  Artist" : "❤️  Enthusiast"}
            </Text>
          </View>

          {/* Input */}
          <View style={styles.field}>
            <Text style={styles.label}>
              {isArtist ? "Artist Name / Full Name" : "Your Name"}
            </Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder={isArtist ? "e.g. Juan dela Cruz" : "e.g. Maria Santos"}
              placeholderTextColor={COLORS.text.muted}
              autoCapitalize="words"
              autoCorrect={false}
              autoFocus
              editable={!loading}
              returnKeyType="done"
              onSubmitEditing={handleContinue}
              maxLength={60}
            />
            <Text style={styles.hint}>
              {isArtist
                ? "You can use your real name or an artist alias."
                : "You can always change this later in your profile."}
            </Text>
          </View>

          {/* CTA */}
          <TouchableOpacity
            style={[styles.primaryBtn, (loading || !name.trim()) && styles.btnDisabled]}
            onPress={handleContinue}
            disabled={loading || !name.trim()}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.primaryBtnText}>
                  {isArtist ? "Continue to Verification" : "Go to Home"}
                </Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </>
            )}
          </TouchableOpacity>

        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Styles ──
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background.primary,
  },
  flex: { flex: 1 },
  content: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 40,
    paddingBottom: 32,
    alignItems: "center",
  },
  iconOuter: {
    position: "relative",
    marginBottom: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  iconCircle: {
    width: 100, height: 100,
    borderRadius: 50,
    backgroundColor: "#FFF0F0",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 2,
  },
  ring: {
    position: "absolute",
    width: 120, height: 120,
    borderRadius: 60,
    borderWidth: 1.5,
    borderColor: "rgba(139,26,26,0.2)",
    zIndex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: COLORS.text.primary,
    marginBottom: 10,
    textAlign: "center",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.text.secondary,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  roleBadge: {
    backgroundColor: "#FFF0F0",
    borderWidth: 1.5,
    borderColor: COLORS.primary.deepRed,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginBottom: 32,
  },
  roleBadgeText: {
    color: COLORS.primary.deepRed,
    fontSize: 13,
    fontWeight: "700",
  },
  field: {
    width: "100%",
    gap: 8,
    marginBottom: 28,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text.primary,
  },
  input: {
    backgroundColor: COLORS.background.secondary,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 14,
    fontSize: 17,
    borderWidth: 1.5,
    borderColor: COLORS.border.light,
    color: COLORS.text.primary,
    fontWeight: "500",
  },
  hint: {
    fontSize: 12,
    color: COLORS.text.muted,
    marginTop: 6,
    fontStyle: "italic",
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: "100%",
    backgroundColor: COLORS.button.primary,
    paddingVertical: 16,
    borderRadius: 14,
    shadowColor: COLORS.button.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  btnDisabled: { opacity: 0.5 },
});
