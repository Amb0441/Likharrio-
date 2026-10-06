import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import {
  doc,
  getDoc,
} from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { auth, db } from "../../lib/firebase";
import LikharrioLogo from "../../components/ui/LikharrioLogo";
import WebLogin from "../../components/web/WebLogin";
import { useLayoutMode } from "../../hooks/useLayoutMode";
import { useAuth } from "../../contexts/AuthContext";
import { withTimeout, SlowNetworkError } from "../../utils/withTimeout";
import { clearLoginFailures, loginLockMessage, recordLoginFailure } from "../../lib/security";

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

export default function LoginScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { isWebsite } = useLayoutMode();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // ── Entrance animations ──
  const headerAnim = useRef(new Animated.Value(0)).current;
  const panelAnim  = useRef(new Animated.Value(0)).current;
  const field1Anim = useRef(new Animated.Value(0)).current;
  const field2Anim = useRef(new Animated.Value(0)).current;
  const btnAnim    = useRef(new Animated.Value(0)).current;
  const footerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isWebsite) return;
    Animated.stagger(90, [
      Animated.spring(headerAnim, { toValue: 1, useNativeDriver: true, tension: 60, friction: 10 }),
      Animated.spring(panelAnim,  { toValue: 1, useNativeDriver: true, tension: 60, friction: 10 }),
      Animated.spring(field1Anim, { toValue: 1, useNativeDriver: true, tension: 60, friction: 10 }),
      Animated.spring(field2Anim, { toValue: 1, useNativeDriver: true, tension: 60, friction: 10 }),
      Animated.spring(btnAnim,    { toValue: 1, useNativeDriver: true, tension: 60, friction: 10 }),
      Animated.spring(footerAnim, { toValue: 1, useNativeDriver: true, tension: 60, friction: 10 }),
    ]).start();
  }, []);

  const fade = (anim: Animated.Value) => ({
    opacity: anim,
    transform: [
      { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) },
    ],
  });

  // ── Auto-navigate verified user ──
  useEffect(() => {
    if (user && user.emailVerified) navigateAfterLogin(user.uid);
  }, [user]);

  const navigateAfterLogin = async (uid: string) => {
    try {
      const snap = await withTimeout(getDoc(doc(db, "users", uid)));
      if (snap.exists() && snap.data()?.role) {
        router.replace("/(app)/home");
      } else {
        router.replace("/(auth)/role-selection");
      }
    } catch (err) {
      if (err instanceof SlowNetworkError) {
        Alert.alert(
          "Slow Connection",
          "Couldn't load your profile. Please check your internet and try again.",
          [{ text: "Retry", onPress: () => navigateAfterLogin(uid) }]
        );
      } else {
        router.replace("/(app)/home");
      }
    }
  };

  // ── Email sign in ──
  const handleEmailLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Missing Fields", "Please enter your email and password.");
      return;
    }
    const locked = loginLockMessage();
    if (locked) {
      Alert.alert("Sign-In Paused", locked);
      return;
    }
    setLoading(true);
    try {
      const { user: signedInUser } = await withTimeout(
        signInWithEmailAndPassword(auth, email.trim(), password)
      );
      clearLoginFailures();
      if (!signedInUser.emailVerified) {
        await signOut(auth);
        Alert.alert(
          "Email Not Verified",
          "Please verify your email before signing in.",
          [
            {
              text: "Resend Email",
              onPress: async () => {
                try {
                  const { user: tempUser } = await signInWithEmailAndPassword(
                    auth,
                    email.trim(),
                    password
                  );
                  await sendEmailVerification(tempUser);
                  await signOut(auth);
                  Alert.alert("Sent!", "Verification email resent.");
                } catch {
                  Alert.alert("Error", "Could not resend email.");
                }
              },
            },
            { text: "OK", style: "cancel" },
          ]
        );
        setLoading(false);
        return;
      }
    } catch (error: any) {
      setLoading(false);
      if (error instanceof SlowNetworkError) {
        Alert.alert("Slow Connection", "Sign-in timed out. Please check your internet and try again.");
        return;
      }
      if (
        error?.code === "auth/invalid-credential" ||
        error?.code === "auth/user-not-found" ||
        error?.code === "auth/wrong-password" ||
        error?.code === "auth/invalid-email"
      ) {
        recordLoginFailure();
      }
      const messages: Record<string, string> = {
        "auth/invalid-credential": "Incorrect email or password.",
        "auth/user-not-found": "Incorrect email or password.",
        "auth/wrong-password": "Incorrect email or password.",
        "auth/invalid-email": "Incorrect email or password.",
        "auth/too-many-requests": "Too many failed attempts. Try again later.",
        "auth/network-request-failed": "Network error. Please check your connection.",
      };
      Alert.alert("Sign-In Failed", loginLockMessage() || messages[error.code] || "Something went wrong.");
    }
  };

  const anyLoading = loading;

  if (isWebsite) {
    return (
      <WebLogin
        email={email}
        password={password}
        showPassword={showPassword}
        loading={loading}
        onChangeEmail={setEmail}
        onChangePassword={setPassword}
        onTogglePassword={() => setShowPassword((value) => !value)}
        onSubmit={handleEmailLogin}
        onForgot={() => router.push("/(auth)/forgot-password")}
        onSignUp={() => router.push("/(auth)/role-selection")}
        onBack={() => router.replace("/(auth)/welcome")}
      />
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <StatusBar barStyle="light-content" />

      {/* Background layers */}
      <View style={styles.bgBase} />
      <View style={styles.bgMid} />
      <View style={styles.bgTop} />
      <TextilePattern />
      <View style={styles.arcOuter} pointerEvents="none" />
      <View style={styles.arcInner} pointerEvents="none" />

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Back button */}
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          disabled={anyLoading}
        >
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>

        {/* Hero */}
        <Animated.View style={[styles.hero, fade(headerAnim)]}>
          <LikharrioLogo size={72} variant="dark" showWordmark={false} showTagline={false} />
          <Text style={styles.heroTitle}>Welcome Back</Text>
          <Text style={styles.heroSub}>Sign in to your Likharrio account</Text>
        </Animated.View>

        {/* Panel */}
        <View style={styles.panel}>

          {/* Email field */}
          <Animated.View style={[styles.field, fade(field1Anim)]}>
            <Text style={styles.label}>Email Address</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="you@example.com"
              placeholderTextColor="#B8A99A"
              editable={!anyLoading}
              autoCorrect={false}
            />
          </Animated.View>

          {/* Password field */}
          <Animated.View style={[styles.field, fade(field2Anim)]}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Password</Text>
              <TouchableOpacity
                onPress={() => router.push("/(auth)/forgot-password")}
                disabled={anyLoading}
              >
                <Text style={styles.forgotText}>Forgot Password?</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.inputWrap}>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                placeholder="Your password"
                placeholderTextColor="#B8A99A"
                autoCapitalize="none"
                editable={!anyLoading}
              />
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Ionicons
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color="#9B8265"
                />
              </TouchableOpacity>
            </View>
          </Animated.View>

          {/* Sign in button */}
          <Animated.View style={fade(btnAnim)}>
            <TouchableOpacity
              style={[styles.primaryBtn, anyLoading && styles.btnDisabled]}
              onPress={handleEmailLogin}
              disabled={anyLoading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#1A0505" />
              ) : (
                <Text style={styles.primaryBtnText}>Sign In</Text>
              )}
            </TouchableOpacity>
          </Animated.View>

          {/* Footer */}
          <Animated.View style={[styles.footerRow, fade(footerAnim)]}>
            <TouchableOpacity
              onPress={() => router.push("/(auth)/role-selection")}
              disabled={anyLoading}
            >
              <Text style={styles.footerText}>
                Don't have an account?{"  "}
                <Text style={styles.footerLink}>Sign Up</Text>
              </Text>
            </TouchableOpacity>
          </Animated.View>
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
  bgBase: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#1A0505",
  },
  bgMid: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    height: "55%",
    backgroundColor: "#3D0E0E",
    opacity: 0.75,
    borderTopLeftRadius: 300,
    borderTopRightRadius: 100,
  },
  bgTop: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    height: "28%",
    backgroundColor: "#7A1212",
    opacity: 0.5,
    borderTopLeftRadius: 200,
  },
  arcOuter: {
    position: "absolute",
    top: -90, right: -90,
    width: 260, height: 260,
    borderRadius: 130,
    borderWidth: 1.5,
    borderColor: "rgba(201,168,76,0.14)",
  },
  arcInner: {
    position: "absolute",
    top: -52, right: -52,
    width: 175, height: 175,
    borderRadius: 88,
    borderWidth: 1,
    borderColor: "rgba(201,168,76,0.10)",
  },
  scroll: { flexGrow: 1, paddingBottom: 0 },
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
  hero: {
    alignItems: "center",
    paddingVertical: 32,
    paddingHorizontal: 32,
    gap: 10,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#FAF3E8",
    letterSpacing: 0.2,
  },
  heroSub: {
    fontSize: 14,
    color: "rgba(250,243,232,0.6)",
    letterSpacing: 0.3,
    textAlign: "center",
  },
  panel: {
    backgroundColor: COLORS.background.primary,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 28,
    paddingTop: 32,
    paddingBottom: 44,
    gap: 14,
    elevation: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    flex: 1,
  },
  field: { gap: 8 },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#4A3829",
  },
  forgotText: {
    fontSize: 12,
    color: COLORS.primary.deepRed,
    fontWeight: "600",
  },
  inputWrap: {
    position: "relative",
  },
  input: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingRight: 44,
    borderRadius: 12,
    fontSize: 15,
    borderWidth: 1.5,
    borderColor: "#E0D5C7",
    color: COLORS.text.primary,
  },
  eyeBtn: {
    position: "absolute",
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingVertical: 15,
    gap: 12,
    borderWidth: 1.5,
    borderColor: "#E0D5C7",
    elevation: 2,
  },
  googleIconWrap: {
    width: 24, height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.primary.deepRed,
    justifyContent: "center",
    alignItems: "center",
  },
  googleIconText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 16,
  },
  googleBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text.primary,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  dividerLine: {
    flex: 1, height: 1,
    backgroundColor: "#E0D5C7",
  },
  dividerLabel: {
    fontSize: 12,
    color: COLORS.text.secondary,
    fontWeight: "500",
  },
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
  btnDisabled: { opacity: 0.6 },
  footerRow: {
    alignItems: "center",
    paddingTop: 4,
  },
  footerText: {
    fontSize: 13,
    color: "#8B7355",
    fontWeight: "500",
  },
  footerLink: {
    color: COLORS.primary.deepRed,
    fontWeight: "700",
  },
});
