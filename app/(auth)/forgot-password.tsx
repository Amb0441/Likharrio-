import { useRouter } from "expo-router";
import { sendPasswordResetEmail } from "firebase/auth";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import COLORS from "../../constants/Colors";
import { auth } from "../../lib/firebase";

// ── Textile pattern decoration ──
function TextilePattern() {
  const positions = [
    { left: -20, top: -20 }, { left: 44, top: -20 }, { left: 108, top: -20 },
    { left: 172, top: -20 }, { left: 236, top: -20 }, { left: 300, top: -20 },
    { left: 12,  top:  44 }, { left: 76,  top:  44 }, { left: 140, top:  44 },
    { left: 204, top:  44 }, { left: 268, top:  44 }, { left: 332, top:  44 },
  ];
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {positions.map((pos, i) => (
        <View key={i} style={[patternStyles.diamond, { left: pos.left, top: pos.top }]} />
      ))}
    </View>
  );
}

export default function ForgotPasswordScreen() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const pulseAnim = useRef(new Animated.Value(1)).current;

  // ── Pulse animation on send success ──
  const triggerPulse = () => {
    Animated.sequence([
      Animated.spring(pulseAnim, {
        toValue: 1.15,
        useNativeDriver: true,
        tension: 80,
        friction: 5,
      }),
      Animated.spring(pulseAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 80,
        friction: 5,
      }),
    ]).start();
  };

  // ── Send reset link ──
  const handleSend = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      setError("Please enter your email address.");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      setError("Please enter a valid email address.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, trimmed);
      triggerPulse();
      setSent(true);
    } catch (e: any) {
      const msgs: Record<string, string> = {
        "auth/user-not-found":   "No account found with that email.",
        "auth/invalid-email":    "Please enter a valid email address.",
        "auth/too-many-requests":"Too many requests. Please wait a moment.",
      };
      setError(msgs[e.code] ?? "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Sent state ──
  if (sent) {
    return (
      <View style={styles.root}>
        <StatusBar barStyle="light-content" />
        <View style={styles.bgBase} />
        <View style={styles.bgMid} />
        <View style={styles.bgTop} />
        <TextilePattern />
        <View style={styles.arcOuter} pointerEvents="none" />

        <View style={styles.sentHero}>
          <Animated.View
            style={[styles.iconCircle, { transform: [{ scale: pulseAnim }] }]}
          >
            <Text style={styles.iconEmoji}>✉️</Text>
          </Animated.View>
          <Text style={styles.heroTitle}>Check Your Email</Text>
          <Text style={styles.heroSub}>Reset link sent to</Text>
          <Text style={styles.emailBadge}>{email.trim()}</Text>
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelNote}>
            Tap the link in the email to reset your password. Didn't see it?
            Check your spam folder.
          </Text>

          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => router.replace("/(auth)/login")}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryBtnText}>Back to Sign In</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => setSent(false)}
            activeOpacity={0.75}
          >
            <Text style={styles.secondaryBtnText}>Didn't receive it? Try again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Input state ──
  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <StatusBar barStyle="light-content" />
      <View style={styles.bgBase} />
      <View style={styles.bgMid} />
      <View style={styles.bgTop} />
      <TextilePattern />
      <View style={styles.arcOuter} pointerEvents="none" />

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          disabled={loading}
        >
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>

        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.iconCircle}>
            <Text style={styles.iconEmoji}>🔑</Text>
          </View>
          <Text style={styles.heroTitle}>Forgot Password?</Text>
          <Text style={styles.heroSub}>
            No worries — we'll send a reset link to your email.
          </Text>
        </View>

        {/* Panel */}
        <View style={styles.panel}>
          <View style={styles.field}>
            <Text style={styles.label}>Email Address</Text>
            <TextInput
              style={[styles.input, error ? styles.inputError : null]}
              value={email}
              onChangeText={(t) => { setEmail(t); setError(""); }}
              placeholder="you@example.com"
              placeholderTextColor="#B8A99A"
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
              editable={!loading}
            />
            {!!error && <Text style={styles.errorText}>⚠ {error}</Text>}
          </View>

          <TouchableOpacity
            style={[styles.primaryBtn, loading && styles.btnDisabled]}
            onPress={handleSend}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#1A0505" />
            ) : (
              <Text style={styles.primaryBtnText}>Send Reset Link</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.backToLogin}
            onPress={() => router.back()}
            disabled={loading}
          >
            <Text style={styles.backToLoginText}>← Back to Sign In</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Pattern styles ──
const patternStyles = StyleSheet.create({
  diamond: {
    position: "absolute",
    width: 36,
    height: 36,
    borderWidth: 1.5,
    borderColor: "rgba(201,168,76,0.13)",
    transform: [{ rotate: "45deg" }],
  },
});

// ── Styles ──
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#1A0505",
  },

  // Background layers
  bgBase: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#1A0505",
  },
  bgMid: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "55%",
    backgroundColor: "#3D0E0E",
    opacity: 0.75,
    borderTopLeftRadius: 300,
    borderTopRightRadius: 100,
  },
  bgTop: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "28%",
    backgroundColor: "#7A1212",
    opacity: 0.5,
    borderTopLeftRadius: 200,
  },
  arcOuter: {
    position: "absolute",
    top: -90,
    right: -90,
    width: 260,
    height: 260,
    borderRadius: 130,
    borderWidth: 1.5,
    borderColor: "rgba(201,168,76,0.14)",
  },

  // Scroll
  scroll: {
    flexGrow: 1,
  },
  backBtn: {
    paddingTop: 52,
    paddingHorizontal: 24,
    paddingBottom: 8,
    alignSelf: "flex-start",
  },
  backBtnText: {
    color: "rgba(201,168,76,0.85)",
    fontSize: 14,
    fontWeight: "600",
  },

  // Hero
  hero: {
    alignItems: "center",
    paddingVertical: 28,
    paddingHorizontal: 32,
    gap: 12,
  },
  sentHero: {
    alignItems: "center",
    paddingTop: 80,
    paddingBottom: 28,
    paddingHorizontal: 32,
    gap: 10,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(201,168,76,0.18)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
    borderWidth: 1.5,
    borderColor: "rgba(201,168,76,0.35)",
  },
  iconEmoji: {
    fontSize: 34,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#FAF3E8",
    letterSpacing: 0.2,
    textAlign: "center",
  },
  heroSub: {
    fontSize: 14,
    color: "rgba(250,243,232,0.6)",
    textAlign: "center",
    lineHeight: 20,
  },
  emailBadge: {
    backgroundColor: "rgba(201,168,76,0.18)",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
    color: "rgba(201,168,76,0.9)",
    fontSize: 13,
    fontWeight: "600",
    borderWidth: 1,
    borderColor: "rgba(201,168,76,0.3)",
  },

  // Panel
  panel: {
    backgroundColor: COLORS.background.primary,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 28,
    paddingTop: 32,
    paddingBottom: 44,
    gap: 14,
    elevation: 18,
    flex: 1,
  },
  panelNote: {
    fontSize: 14,
    color: COLORS.text.secondary,
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 8,
  },

  // Form
  field: {
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#4A3829",
  },
  input: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    fontSize: 15,
    borderWidth: 1.5,
    borderColor: "#E0D5C7",
    color: COLORS.text.primary,
  },
  inputError: {
    borderColor: "#DC2626",
  },
  errorText: {
    fontSize: 12,
    color: "#DC2626",
    marginTop: 2,
  },

  // Buttons
  primaryBtn: {
    backgroundColor: "#C9A84C",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    elevation: 4,
    shadowColor: "#C9A84C",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  primaryBtnText: {
    color: "#1A0505",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  secondaryBtn: {
    alignItems: "center",
    paddingVertical: 8,
  },
  secondaryBtnText: {
    fontSize: 13,
    color: COLORS.primary.deepRed,
    fontWeight: "600",
  },
  backToLogin: {
    alignItems: "center",
    paddingVertical: 8,
  },
  backToLoginText: {
    fontSize: 13,
    color: COLORS.text.secondary,
    fontWeight: "500",
  },
});
