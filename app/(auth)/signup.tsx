import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { createUserWithEmailAndPassword, sendEmailVerification } from "firebase/auth";
import { collection, doc, getDocs, query, setDoc, where } from "firebase/firestore";
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
import { auth, db } from "../../lib/firebase";
import { accountRole } from "../../lib/security";
import COLORS from "../../constants/Colors";
import { useAuth } from "../../contexts/AuthContext";

// ── Password strength ──
type StrengthLevel = "empty" | "weak" | "fair" | "strong";

function getPasswordStrength(pw: string): StrengthLevel {
  if (!pw) return "empty";
  let score = 0;
  if (pw.length >= 8)           score++;
  if (pw.length >= 12)          score++;
  if (/[A-Z]/.test(pw))        score++;
  if (/[0-9]/.test(pw))        score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return "weak";
  if (score <= 3) return "fair";
  return "strong";
}

const STRENGTH_CONFIG: Record<StrengthLevel, { label: string; color: string; bars: number }> = {
  empty:  { label: "",                          color: "transparent", bars: 0 },
  weak:   { label: "Weak — too easy to guess",  color: "#EF4444",     bars: 1 },
  fair:   { label: "Fair — getting better",     color: "#F59E0B",     bars: 2 },
  strong: { label: "Strong",                    color: "#10B981",     bars: 3 },
};

const GENDER_OPTIONS = ["Male", "Female", "Non-Binary", "Prefer not to say"];

const ART_CATEGORIES = [
  { label: "Painting",               icon: "🎨" },
  { label: "Drawing & Illustration", icon: "✏️" },
  { label: "Weaving & Textiles",     icon: "🧵" },
  { label: "Wood Craft",             icon: "🪵" },
  { label: "Sculpture",              icon: "🗿" },
  { label: "Other",                  icon: "✨" },
];

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

export default function SignupScreen() {
  const router = useRouter();
  const { role } = useLocalSearchParams<{ role: string }>();
  const { user } = useAuth();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // ── Enthusiast step-1 fields ──
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [selectedArts, setSelectedArts] = useState<string[]>([]);

  // ── Credentials fields ──
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // ── Referral (artist only) ──
  const [showReferral, setShowReferral] = useState(false);
  const [referralCode, setReferralCode] = useState("");
  const [referralError, setReferralError] = useState("");
  const [referralVerified, setReferralVerified] = useState(false);
  const [checkingReferral, setCheckingReferral] = useState(false);

  // ── Entrance animations ──
  const headerAnim = useRef(new Animated.Value(0)).current;
  const panelAnim  = useRef(new Animated.Value(0)).current;

  const runEntrance = () => {
    headerAnim.setValue(0);
    panelAnim.setValue(0);
    Animated.stagger(100, [
      Animated.spring(headerAnim, { toValue: 1, useNativeDriver: true, tension: 60, friction: 10 }),
      Animated.spring(panelAnim,  { toValue: 1, useNativeDriver: true, tension: 60, friction: 10 }),
    ]).start();
  };

  useEffect(() => { runEntrance(); }, []);
  useEffect(() => { runEntrance(); }, [step]);
  useEffect(() => { if (user?.emailVerified) router.replace("/(app)/home"); }, [user]);

  const fade = (anim: Animated.Value) => ({
    opacity: anim,
    transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
  });

  const toggleArt = (art: string) =>
    setSelectedArts((prev) =>
      prev.includes(art) ? prev.filter((a) => a !== art) : [...prev, art]
    );

  // ── Step 1 validation ──
  const handleNext = () => {
    if (role === "enthusiast") {
      const ageNum = parseInt(age);
      if (!age || isNaN(ageNum) || ageNum < 18 || ageNum > 99) {
        Alert.alert("Age Required", "Please enter a valid age between 18 and 99.");
        return;
      }
      if (!gender) {
        Alert.alert("Gender Required", "Please select your gender.");
        return;
      }
      if (selectedArts.length === 0) {
        Alert.alert("Interests Required", "Please select at least one art form.");
        return;
      }
    }
    setStep(2);
  };

  // ── Referral validation ──
  const validateReferralCode = async (code: string): Promise<boolean> => {
    if (!code.trim()) return true;
    setCheckingReferral(true);
    setReferralError("");
    try {
      const q = query(
        collection(db, "users"),
        where("referralCode", "==", code.trim().toUpperCase())
      );
      const snap = await getDocs(q);
      if (snap.empty) {
        setReferralError("Invalid referral code. Please check and try again.");
        setReferralVerified(false);
        return false;
      }
      setReferralVerified(true);
      return true;
    } catch {
      setReferralError("Could not verify referral code. Try again.");
      return false;
    } finally {
      setCheckingReferral(false);
    }
  };

  // ── Email sign-up ──
  const handleEmailSignup = async () => {
    if (!email.trim() || !password || !confirmPassword) {
      Alert.alert("Missing Fields", "Please fill in all fields.");
      return;
    }
    if (role === "artist" && referralCode.trim()) {
      const valid = await validateReferralCode(referralCode);
      if (!valid) return;
    }
    if (password !== confirmPassword) {
      Alert.alert("Password Mismatch", "Passwords do not match.");
      return;
    }
    const strength = getPasswordStrength(password);
    if (strength === "weak" || password.length < 6) {
      Alert.alert("Password Too Weak", "Use at least 8 characters with uppercase, numbers, or symbols.");
      return;
    }
    setLoading(true);
    try {
      const { user: newUser } = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const userData: Record<string, any> = {
        uid: newUser.uid,
        displayName: newUser.email?.split("@")[0] ?? "User",
        name: newUser.email?.split("@")[0] ?? "User",
        authProvider: "email",
        role: accountRole(role),
        verified: false,
        artistStatus: accountRole(role) === "artist" ? "unsubmitted" : null,
        createdAt: new Date().toISOString(),
      };
      if (role === "enthusiast") {
        userData.artPreferences = selectedArts;
      }
      const privateData: Record<string, any> = { email: newUser.email };
      if (role === "enthusiast") {
        privateData.age = parseInt(age);
        privateData.gender = gender;
      }
      if (role === "artist" && referralCode.trim()) {
        privateData.usedReferralCode = referralCode.trim().toUpperCase();
      }
      await setDoc(doc(db, "users", newUser.uid), userData);
      await setDoc(doc(db, "users", newUser.uid, "private", "account"), privateData);
      await sendEmailVerification(newUser);
      router.replace({ pathname: "/(auth)/verify-email", params: { email: newUser.email ?? "" } });
    } catch (error: any) {
      setLoading(false);
      const msgs: Record<string, string> = {
        "auth/email-already-in-use": "An account already exists with this email.",
        "auth/invalid-email":        "Please enter a valid email address.",
        "auth/weak-password":        "Password is too weak.",
      };
      Alert.alert("Sign Up Failed", msgs[error.code] ?? "Something went wrong.");
    }
  };

  const anyLoading = loading;
  const showStep1    = role === "enthusiast" && step === 1;
  const roleLabel    = role ? role.charAt(0).toUpperCase() + role.slice(1) : "User";

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

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Back */}
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => (step === 2 && role === "enthusiast") ? setStep(1) : router.back()}
          disabled={anyLoading}
        >
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>

        {/* Hero */}
        <Animated.View style={[styles.hero, fade(headerAnim)]}>
          <View style={styles.rolePill}>
            <Text style={styles.rolePillText}>{roleLabel}</Text>
          </View>
          <Text style={styles.heroTitle}>
            {showStep1 ? "Tell us\nabout yourself" : "Create\nyour account"}
          </Text>
          {role === "enthusiast" && (
            <View style={styles.stepRow}>
              <View style={[styles.stepDot, step >= 1 && styles.stepDotActive]} />
              <View style={[styles.stepLine, step >= 2 && styles.stepLineActive]} />
              <View style={[styles.stepDot, step === 2 && styles.stepDotActive]} />
            </View>
          )}
        </Animated.View>

        {/* Panel */}
        <Animated.View style={[styles.panel, fade(panelAnim)]}>

          {/* ── Step 1: Enthusiast details ── */}
          {showStep1 && (
            <View style={styles.form}>

              {/* Age */}
              <View style={styles.field}>
                <Text style={styles.label}>Age</Text>
                <TextInput
                  style={styles.input}
                  value={age}
                  onChangeText={setAge}
                  placeholder="e.g. 21"
                  placeholderTextColor="#B8A99A"
                  keyboardType="number-pad"
                  maxLength={2}
                />
              </View>

              {/* Gender */}
              <View style={styles.field}>
                <Text style={styles.label}>Gender</Text>
                <View style={styles.chips}>
                  {GENDER_OPTIONS.map((opt) => (
                    <TouchableOpacity
                      key={opt}
                      style={[styles.chip, gender === opt && styles.chipOn]}
                      onPress={() => setGender(opt)}
                    >
                      <Text style={[styles.chipText, gender === opt && styles.chipTextOn]}>{opt}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Art interests */}
              <View style={styles.field}>
                <Text style={styles.label}>
                  Art Interests{" "}
                  <Text style={styles.labelNote}>(select all that apply)</Text>
                </Text>
                <Text style={styles.selectionHint}>
                  {selectedArts.length === 0
                    ? "Pick at least one to personalise your feed"
                    : `${selectedArts.length} selected — we'll find matching art for you`}
                </Text>
                <View style={styles.chips}>
                  {ART_CATEGORIES.map((art) => {
                    const active = selectedArts.includes(art.label);
                    return (
                      <TouchableOpacity
                        key={art.label}
                        style={[styles.chip, active && styles.chipOn]}
                        onPress={() => toggleArt(art.label)}
                      >
                        <Text style={styles.chipIcon}>{art.icon}</Text>
                        <Text style={[styles.chipText, active && styles.chipTextOn]}>{art.label}</Text>
                        {active && <Text style={styles.chipCheck}>✓</Text>}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={handleNext}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryBtnText}>Next →</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── Step 2 / Artist: Credentials ── */}
          {!showStep1 && (
            <View style={styles.form}>

              {/* Referral code — artist only */}
              {role === "artist" && (
                <View style={styles.field}>
                  <TouchableOpacity
                    style={styles.referralToggle}
                    onPress={() => {
                      setShowReferral((v) => !v);
                      if (showReferral) {
                        setReferralCode("");
                        setReferralError("");
                        setReferralVerified(false);
                      }
                    }}
                  >
                    <Text style={styles.referralToggleText}>
                      {showReferral ? "▾  Hide referral code" : "▸  Have a referral code? (optional)"}
                    </Text>
                  </TouchableOpacity>
                  {showReferral && (
                    <>
                      <View style={styles.referralRow}>
                        <TextInput
                          style={[
                            styles.input,
                            styles.referralInput,
                            referralVerified && { borderColor: "#10B981" },
                            !!referralError   && { borderColor: "#EF4444" },
                          ]}
                          value={referralCode}
                          onChangeText={(t) => {
                            setReferralCode(t);
                            setReferralError("");
                            setReferralVerified(false);
                          }}
                          placeholder="e.g. LKHR-AB12-5678"
                          placeholderTextColor="#B8A99A"
                          autoCapitalize="characters"
                          autoCorrect={false}
                          editable={!anyLoading}
                        />
                        <TouchableOpacity
                          style={[styles.verifyBtn, referralVerified && styles.verifyBtnDone]}
                          onPress={() => validateReferralCode(referralCode)}
                          disabled={checkingReferral || !referralCode.trim()}
                        >
                          {checkingReferral ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <Text style={styles.verifyBtnText}>{referralVerified ? "✓" : "Verify"}</Text>
                          )}
                        </TouchableOpacity>
                      </View>
                      {referralError ? (
                        <Text style={styles.inputError}>{referralError}</Text>
                      ) : referralVerified ? (
                        <Text style={styles.inputSuccess}>✓ Valid referral code!</Text>
                      ) : (
                        <Text style={styles.inputHint}>Ask an existing verified artist for their code.</Text>
                      )}
                    </>
                  )}
                </View>
              )}

              {/* Email */}
              <View style={styles.field}>
                <Text style={styles.label}>Email Address</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  textContentType="oneTimeCode"
                  autoComplete="off"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  placeholder="you@example.com"
                  placeholderTextColor="#B8A99A"
                  editable={!anyLoading}
                />
              </View>

              {/* Password */}
              <View style={styles.field}>
                <Text style={styles.label}>Password</Text>
                <View style={styles.inputWrap}>
                  <TextInput
                    style={[styles.input, { paddingRight: 44 }]}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    placeholder="Min. 8 chars with letters, numbers & symbols"
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
                {password.length > 0 && (() => {
                  const s = getPasswordStrength(password);
                  const cfg = STRENGTH_CONFIG[s];
                  return (
                    <View style={styles.strengthWrap}>
                      <View style={styles.strengthBars}>
                        {[1, 2, 3].map((b) => (
                          <View
                            key={b}
                            style={[styles.strengthBar, { backgroundColor: b <= cfg.bars ? cfg.color : "#E0D5C7" }]}
                          />
                        ))}
                      </View>
                      <Text style={[styles.strengthLabel, { color: cfg.color }]}>{cfg.label}</Text>
                    </View>
                  );
                })()}
              </View>

              {/* Confirm password */}
              <View style={styles.field}>
                <Text style={styles.label}>Confirm Password</Text>
                <View style={styles.inputWrap}>
                  <TextInput
                    style={[styles.input, { paddingRight: 44 }]}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showConfirmPassword}
                    placeholder="Re-enter password"
                    placeholderTextColor="#B8A99A"
                    autoCapitalize="none"
                    editable={!anyLoading}
                  />
                  <TouchableOpacity
                    style={styles.eyeBtn}
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    <Ionicons
                      name={showConfirmPassword ? "eye-off-outline" : "eye-outline"}
                      size={20}
                      color="#9B8265"
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Submit */}
              <TouchableOpacity
                style={[styles.primaryBtn, anyLoading && styles.btnDisabled]}
                onPress={handleEmailSignup}
                disabled={anyLoading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#1A0505" />
                ) : (
                  <Text style={styles.primaryBtnText}>Create Account</Text>
                )}
              </TouchableOpacity>

              {/* Footer */}
              <TouchableOpacity
                style={styles.footerRow}
                onPress={() => router.push("/(auth)/login")}
              >
                <Text style={styles.footerText}>
                  Already have an account?{"  "}
                  <Text style={styles.footerLink}>Sign In</Text>
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>
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
    paddingBottom: 0,
  },
  backBtn: {
    paddingTop: 52,
    paddingHorizontal: 24,
    paddingBottom: 4,
    alignSelf: "flex-start",
  },
  backBtnText: {
    color: "rgba(201,168,76,0.85)",
    fontSize: 14,
    fontWeight: "600",
  },

  // Hero
  hero: {
    paddingHorizontal: 28,
    paddingBottom: 28,
    paddingTop: 12,
    gap: 10,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#FAF3E8",
    letterSpacing: -0.3,
    lineHeight: 36,
  },
  rolePill: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(201,168,76,0.18)",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "rgba(201,168,76,0.35)",
  },
  rolePillText: {
    color: "rgba(201,168,76,0.9)",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  stepDotActive: {
    backgroundColor: "#C9A84C",
    transform: [{ scale: 1.3 }],
  },
  stepLine: {
    width: 28,
    height: 2,
    backgroundColor: "rgba(255,255,255,0.15)",
    marginHorizontal: 6,
  },
  stepLineActive: {
    backgroundColor: "#C9A84C",
  },

  // Panel
  panel: {
    backgroundColor: COLORS.background.primary,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: 32,
    paddingBottom: 44,
    elevation: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
  },
  form: {
    paddingHorizontal: 28,
    gap: 16,
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
  labelNote: {
    fontWeight: "400",
    color: COLORS.text.muted,
  },
  selectionHint: {
    fontSize: 11,
    color: COLORS.text.muted,
    fontStyle: "italic",
  },
  inputWrap: {
    position: "relative",
  },
  eyeBtn: {
    position: "absolute",
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  input: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    fontSize: 15,
    borderWidth: 1.5,
    borderColor: "#E0D5C7",
    color: "#2A1005",
  },

  // Chips
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: "#E0D5C7",
    backgroundColor: "#fff",
  },
  chipOn: {
    backgroundColor: "#8B1A1A",
    borderColor: "#8B1A1A",
  },
  chipIcon: {
    fontSize: 13,
  },
  chipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B5946",
  },
  chipTextOn: {
    color: "#fff",
  },
  chipCheck: {
    fontSize: 10,
    color: "#fff",
    fontWeight: "800",
  },

  // Google button
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
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#8B1A1A",
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
    color: "#2A1005",
  },

  // Divider
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#E0D5C7",
  },
  dividerLabel: {
    fontSize: 12,
    color: COLORS.text.muted,
    fontWeight: "500",
  },

  // Buttons
  primaryBtn: {
    backgroundColor: "#C9A84C",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    elevation: 4,
    marginTop: 4,
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

  // Password strength
  strengthWrap: {
    gap: 4,
    marginTop: 8,
  },
  strengthBars: {
    flexDirection: "row",
    gap: 6,
  },
  strengthBar: {
    flex: 1,
    height: 4,
    borderRadius: 4,
  },
  strengthLabel: {
    fontSize: 11,
    fontWeight: "600",
  },

  // Referral
  referralToggle: {
    paddingVertical: 6,
  },
  referralToggleText: {
    fontSize: 13,
    color: "#8B1A1A",
    fontWeight: "600",
  },
  referralRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  referralInput: {
    flex: 1,
  },
  verifyBtn: {
    backgroundColor: "#8B1A1A",
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 72,
  },
  verifyBtnDone: {
    backgroundColor: "#10B981",
  },
  verifyBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13,
  },
  inputError: {
    fontSize: 11,
    color: "#EF4444",
    marginTop: 2,
  },
  inputSuccess: {
    fontSize: 11,
    color: "#10B981",
    marginTop: 2,
    fontWeight: "600",
  },
  inputHint: {
    fontSize: 11,
    color: COLORS.text.muted,
    marginTop: 2,
  },

  // Footer
  footerRow: {
    alignItems: "center",
    paddingVertical: 4,
  },
  footerText: {
    fontSize: 13,
    color: "#8B7355",
    fontWeight: "500",
  },
  footerLink: {
    color: "#8B1A1A",
    fontWeight: "700",
  },
});
