import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { reload, sendEmailVerification } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth, db } from "../../lib/firebase";
import COLORS from "../../constants/Colors";
import { useAuth } from "../../contexts/AuthContext";
import { withTimeout, SlowNetworkError } from "../../utils/withTimeout";

export default function VerifyEmailScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email: string }>();
  const { refreshUserProfile } = useAuth();

  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const STEPS = [
    { icon: "mail-outline"     as const, text: "Open your email app" },
    { icon: "search-outline"   as const, text: "Find the email from Likharrio" },
    { icon: "finger-print"     as const, text: "Tap the verification link" },
    { icon: "checkmark-circle" as const, text: "Come back and press below" },
  ];

  // ── Check verification then route ──
  const handleContinue = async () => {
    setChecking(true);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        router.replace("/(auth)/login");
        return;
      }
      await withTimeout(reload(currentUser));
      if (currentUser.emailVerified) {
        await refreshUserProfile();
        const snap = await withTimeout(getDoc(doc(db, "users", currentUser.uid)));
        const role = snap.exists() ? snap.data().role : null;
        router.replace({
          pathname: "/(auth)/set-name",
          params: { role: role ?? "enthusiast" },
        } as any);
      } else {
        Alert.alert(
          "Not Verified Yet",
          "We still haven't received your verification. Please check your inbox and tap the link, then press \"I've Verified\" again.",
          [{ text: "OK" }]
        );
      }
    } catch (e) {
      if (e instanceof SlowNetworkError) {
        Alert.alert(
          "Slow Connection",
          "Verification check timed out. Please check your internet and try again.",
          [{ text: "OK" }]
        );
      } else {
        console.error("Reload error:", e);
        Alert.alert("Error", "Could not check verification status. Please try again.");
      }
    } finally {
      setChecking(false);
    }
  };

  // ── Resend with 60s cooldown ──
  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setResending(true);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        router.replace("/(auth)/login");
        return;
      }
      await withTimeout(sendEmailVerification(currentUser));
      Alert.alert("Sent!", "A new verification email has been sent.");
      setResendCooldown(60);
      const interval = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) { clearInterval(interval); return 0; }
          return prev - 1;
        });
      }, 1000);
    } catch (e: any) {
      if (e instanceof SlowNetworkError) {
        Alert.alert("Slow Connection", "Could not send email — please check your connection and try again.");
        return;
      }
      const msgs: Record<string, string> = {
        "auth/too-many-requests": "Too many requests. Please wait a moment.",
        "auth/network-request-failed": "Network error. Please check your connection.",
      };
      Alert.alert("Error", msgs[e.code] ?? "Failed to resend. Please try again.");
    } finally {
      setResending(false);
    }
  };

  // ── Cancel / sign out ──
  const handleSignOut = () => {
    Alert.alert(
      "Cancel Sign Up?",
      "Your account was created but your email isn't verified yet. You can verify later by signing in.",
      [
        { text: "Stay Here", style: "cancel" },
        { text: "Go to Sign In", style: "destructive", onPress: () => router.replace("/(auth)/login") },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.content}>

        {/* Icon */}
        <View style={styles.iconOuter}>
          <View style={styles.iconCircle}>
            <Ionicons name="mail-unread" size={52} color={COLORS.primary.deepRed} />
          </View>
          <View style={styles.ring} />
        </View>

        <Text style={styles.title}>Verify Your Email</Text>

        <Text style={styles.body}>
          We sent a verification link to{"\n"}
          <Text style={styles.emailText}>{email || "your email address"}</Text>
        </Text>

        <Text style={styles.instructions}>
          Open your email app, find the message from Likharrio, and tap the
          verification link. Then come back here and press the button below.
        </Text>

        {/* Steps card */}
        <View style={styles.stepsCard}>
          {STEPS.map((step, i) => (
            <View key={i} style={[styles.step, i < STEPS.length - 1 && styles.stepBorder]}>
              <View style={styles.stepIconWrap}>
                <Ionicons name={step.icon} size={18} color={COLORS.primary.deepRed} />
              </View>
              <Text style={styles.stepText}>{step.text}</Text>
            </View>
          ))}
        </View>

        {/* Primary CTA */}
        <TouchableOpacity
          style={[styles.primaryBtn, checking && styles.btnDisabled]}
          onPress={handleContinue}
          disabled={checking}
        >
          {checking ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
              <Text style={styles.primaryBtnText}>I've Verified My Email</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Resend */}
        <TouchableOpacity
          style={[styles.resendBtn, (resendCooldown > 0 || resending) && styles.resendBtnDisabled]}
          onPress={handleResend}
          disabled={resendCooldown > 0 || resending}
        >
          {resending ? (
            <ActivityIndicator size="small" color={COLORS.primary.deepRed} />
          ) : (
            <Text style={styles.resendText}>
              {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend verification email"}
            </Text>
          )}
        </TouchableOpacity>

        {/* Spam note */}
        <View style={styles.spamNote}>
          <Ionicons name="information-circle-outline" size={14} color={COLORS.text.muted} />
          <Text style={styles.spamText}>Can't find it? Check your spam or junk folder.</Text>
        </View>

        <TouchableOpacity style={styles.cancelBtn} onPress={handleSignOut}>
          <Text style={styles.cancelText}>Back to Sign In</Text>
        </TouchableOpacity>

      </View>
    </SafeAreaView>
  );
}

// ── Styles ──
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background.primary,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 24,
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
    marginBottom: 12,
    textAlign: "center",
  },
  body: {
    fontSize: 15,
    color: COLORS.text.secondary,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 8,
  },
  emailText: {
    fontWeight: "700",
    color: COLORS.text.primary,
  },
  instructions: {
    fontSize: 13,
    color: COLORS.text.muted,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  stepsCard: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingHorizontal: 20,
    marginBottom: 28,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  step: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
  },
  stepBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "#F0EBE3",
  },
  stepIconWrap: {
    width: 34, height: 34,
    borderRadius: 10,
    backgroundColor: "#FFF0F0",
    justifyContent: "center",
    alignItems: "center",
  },
  stepText: {
    fontSize: 14,
    color: COLORS.text.primary,
    fontWeight: "500",
    flex: 1,
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
    marginBottom: 12,
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
  btnDisabled: { opacity: 0.6 },
  resendBtn: { paddingVertical: 10, marginBottom: 8 },
  resendBtnDisabled: { opacity: 0.4 },
  resendText: {
    fontSize: 14,
    color: COLORS.primary.deepRed,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  spamNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 24,
  },
  spamText: {
    fontSize: 12,
    color: COLORS.text.muted,
  },
  cancelBtn: { paddingVertical: 8 },
  cancelText: {
    fontSize: 14,
    color: COLORS.text.muted,
    fontWeight: "500",
  },
});
