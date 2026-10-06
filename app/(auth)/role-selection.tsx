import { useRouter } from "expo-router";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { db } from "../../lib/firebase";
import COLORS from "../../constants/Colors";
import { useAuth } from "../../contexts/AuthContext";
import { useLayoutMode } from "../../hooks/useLayoutMode";
import LikharrioLogo from "../../components/ui/LikharrioLogo";

// ── Textile pattern decoration ──
function TextilePattern() {
  const positions = [
    { left: -20, top: -20 }, { left: 44, top: -20 }, { left: 108, top: -20 },
    { left: 172, top: -20 }, { left: 236, top: -20 }, { left: 300, top: -20 },
    { left: 12,  top:  44 }, { left: 76,  top:  44 }, { left: 140, top:  44 },
    { left: 204, top:  44 }, { left: 268, top:  44 }, { left: 332, top:  44 },
    { left: -20, top: 108 }, { left: 44,  top: 108 }, { left: 108, top: 108 },
    { left: 172, top: 108 }, { left: 236, top: 108 }, { left: 300, top: 108 },
  ];
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {positions.map((pos, i) => (
        <View key={i} style={[patternStyles.diamond, { left: pos.left, top: pos.top }]} />
      ))}
    </View>
  );
}

export default function RoleSelection() {
  const [selectedRole, setSelectedRole] = useState<"artist" | "enthusiast" | null>(null);
  const [loading, setLoading] = useState(false);
  const { user, userProfile, refreshUserProfile } = useAuth();
  const { isWebsite } = useLayoutMode();
  const router = useRouter();

  // ── Entrance animations ──
  const headerAnim  = useRef(new Animated.Value(0)).current;
  const card1Anim   = useRef(new Animated.Value(0)).current;
  const card2Anim   = useRef(new Animated.Value(0)).current;
  const btnAnim     = useRef(new Animated.Value(0)).current;
  const artistScale = useRef(new Animated.Value(1)).current;
  const enthScale   = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.stagger(120, [
      Animated.spring(headerAnim, { toValue: 1, useNativeDriver: true, tension: 55, friction: 10 }),
      Animated.spring(card1Anim,  { toValue: 1, useNativeDriver: true, tension: 55, friction: 10 }),
      Animated.spring(card2Anim,  { toValue: 1, useNativeDriver: true, tension: 55, friction: 10 }),
      Animated.spring(btnAnim,    { toValue: 1, useNativeDriver: true, tension: 55, friction: 10 }),
    ]).start();
  }, []);

  useEffect(() => {
    if (user && userProfile?.role) {
      if (userProfile.role === "artist") router.replace("/(app)/artist/artist-home");
      else if (userProfile.role === "enthusiast") router.replace("/(app)/enthusiast/enthusiast-home");
    }
  }, [user, userProfile]);

  const fade = (anim: Animated.Value) => ({
    opacity: anim,
    transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) }],
  });

  // ── Card press with bounce ──
  const pressCard = (scaleAnim: Animated.Value, role: "artist" | "enthusiast") => {
    setSelectedRole(role);
    Animated.sequence([
      Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true, tension: 100, friction: 8 }),
      Animated.spring(scaleAnim, { toValue: 1,    useNativeDriver: true, tension: 100, friction: 8 }),
    ]).start();
  };

  // ── Continue ──
  const handleContinue = async () => {
    if (!selectedRole) {
      Alert.alert("Choose a role", "Select Artist or Enthusiast to continue.");
      return;
    }
    setLoading(true);
    if (!user) {
      router.push({ pathname: "/(auth)/signup", params: { role: selectedRole } });
      setLoading(false);
      return;
    }
    try {
      await setDoc(doc(db, "users", user.uid), {
        role: selectedRole,
        verified: selectedRole === "artist" ? false : null,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      await refreshUserProfile();
      if (selectedRole === "artist") router.replace("/(app)/artist/artist-home");
      else router.replace("/(app)/enthusiast/enthusiast-home");
    } catch {
      Alert.alert("Error", "Failed to save your role. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const roleLabel = selectedRole
    ? selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1)
    : "…";

  if (isWebsite) {
    return (
      <View style={webStyles.page}>
        <View style={webStyles.nav}>
          <LikharrioLogo size={28} variant="light" showWordmark={false} showTagline={false} />
          <Text style={webStyles.brand}>Likharrio</Text>
        </View>
        <View style={webStyles.center}>
          <Text style={webStyles.title}>How will you use Likharrio?</Text>
          <Text style={webStyles.sub}>Pick a role. You can keep the same account either way.</Text>
          <View style={webStyles.row}>
            <TouchableOpacity
              style={[webStyles.choice, selectedRole === "artist" && webStyles.choiceOn]}
              onPress={() => pressCard(artistScale, "artist")}
              disabled={loading}
            >
              <Text style={webStyles.choiceTitle}>Artist</Text>
              <Text style={webStyles.choiceBody}>Share work, build a portfolio, and connect with collectors.</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[webStyles.choice, selectedRole === "enthusiast" && webStyles.choiceOn]}
              onPress={() => pressCard(enthScale, "enthusiast")}
              disabled={loading}
            >
              <Text style={webStyles.choiceTitle}>Enthusiast</Text>
              <Text style={webStyles.choiceBody}>Discover art, follow makers, and save what you love.</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[webStyles.continue, (!selectedRole || loading) && webStyles.continueOff]}
            onPress={handleContinue}
            disabled={!selectedRole || loading}
          >
            <Text style={webStyles.continueText}>
              {loading ? "Saving…" : selectedRole ? `Continue as ${roleLabel}` : "Choose a role"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.back()} disabled={loading}>
            <Text style={webStyles.back}>Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />

      {/* Background layers */}
      <View style={styles.bgBase} />
      <View style={styles.bgMid} />
      <View style={styles.bgTop} />
      <TextilePattern />
      <View style={styles.arcOuter} pointerEvents="none" />
      <View style={styles.arcInner} pointerEvents="none" />
      <View style={styles.bottomBand} pointerEvents="none" />

      {/* Hero */}
      <Animated.View style={[styles.hero, fade(headerAnim)]}>
        <View style={styles.taglineRow}>
          <View style={styles.taglineLine} />
          <Text style={styles.taglineText}>LIKHARRIO</Text>
          <View style={styles.taglineLine} />
        </View>
        <Text style={styles.heroTitle}>How will you{"\n"}create today?</Text>
        <Text style={styles.heroSub}>Choose your role to get started</Text>
      </Animated.View>

      {/* Panel */}
      <View style={styles.panel}>

        {/* Role cards */}
        <View style={styles.cardsArea}>

          {/* Artist */}
          <Animated.View style={[fade(card1Anim), { transform: [{ scale: artistScale }] }]}>
            <TouchableOpacity
              style={[styles.roleCard, selectedRole === "artist" && styles.roleCardSelected]}
              onPress={() => pressCard(artistScale, "artist")}
              disabled={loading}
              activeOpacity={1}
            >
              <View style={[styles.cardIconWrap, selectedRole === "artist" && styles.cardIconWrapSelected]}>
                <Text style={styles.cardIconEmoji}>🎨</Text>
              </View>
              <View style={styles.cardBody}>
                <Text style={[styles.cardTitle, selectedRole === "artist" && styles.cardTitleSelected]}>
                  Artist
                </Text>
                <Text style={styles.cardDesc}>
                  Share your work · Build a portfolio · Connect with collectors
                </Text>
              </View>
              <View style={[styles.cardRadio, selectedRole === "artist" && styles.cardRadioSelected]}>
                {selectedRole === "artist" && <View style={styles.cardRadioDot} />}
              </View>
            </TouchableOpacity>
          </Animated.View>

          {/* Enthusiast */}
          <Animated.View style={[fade(card2Anim), { transform: [{ scale: enthScale }] }]}>
            <TouchableOpacity
              style={[styles.roleCard, selectedRole === "enthusiast" && styles.roleCardSelected]}
              onPress={() => pressCard(enthScale, "enthusiast")}
              disabled={loading}
              activeOpacity={1}
            >
              <View style={[styles.cardIconWrap, selectedRole === "enthusiast" && styles.cardIconWrapSelected]}>
                <Text style={styles.cardIconEmoji}>❤️</Text>
              </View>
              <View style={styles.cardBody}>
                <Text style={[styles.cardTitle, selectedRole === "enthusiast" && styles.cardTitleSelected]}>
                  Enthusiast
                </Text>
                <Text style={styles.cardDesc}>
                  Discover art · Support creators · Save your favorites
                </Text>
              </View>
              <View style={[styles.cardRadio, selectedRole === "enthusiast" && styles.cardRadioSelected]}>
                {selectedRole === "enthusiast" && <View style={styles.cardRadioDot} />}
              </View>
            </TouchableOpacity>
          </Animated.View>
        </View>

        {/* Bottom actions */}
        <Animated.View style={[styles.bottomActions, fade(btnAnim)]}>
          <TouchableOpacity
            style={[styles.primaryBtn, (!selectedRole || loading) && styles.btnDisabled]}
            onPress={handleContinue}
            disabled={!selectedRole || loading}
            activeOpacity={0.85}
          >
            <Text style={[styles.primaryBtnText, (!selectedRole || loading) && styles.primaryBtnTextDisabled]}>
              {loading ? "Processing…" : `Continue as ${roleLabel}`}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.backRow}
            onPress={() => router.back()}
            disabled={loading}
          >
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
        </Animated.View>

      </View>
    </View>
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
    height: "60%",
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
    height: "30%",
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
  arcInner: {
    position: "absolute",
    top: -52,
    right: -52,
    width: 175,
    height: 175,
    borderRadius: 88,
    borderWidth: 1,
    borderColor: "rgba(201,168,76,0.10)",
  },
  bottomBand: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: "rgba(201,168,76,0.55)",
  },

  // Hero
  hero: {
    paddingTop: 56,
    paddingBottom: 24,
    paddingHorizontal: 28,
    alignItems: "flex-start",
    gap: 10,
  },
  taglineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 4,
  },
  taglineLine: {
    width: 32,
    height: 1,
    backgroundColor: "rgba(201,168,76,0.4)",
  },
  taglineText: {
    color: "rgba(201,168,76,0.82)",
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 3,
  },
  heroTitle: {
    fontSize: 30,
    fontWeight: "800",
    color: "#FAF3E8",
    letterSpacing: -0.5,
    lineHeight: 38,
  },
  heroSub: {
    fontSize: 14,
    color: "rgba(250,243,232,0.55)",
    letterSpacing: 0.2,
  },

  // Panel
  panel: {
    flex: 1,
    backgroundColor: COLORS.background.primary,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 22,
    paddingTop: 28,
    paddingBottom: 44,
    elevation: 18,
    justifyContent: "space-between",
  },

  // Cards
  cardsArea: {
    gap: 14,
  },
  roleCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    backgroundColor: "#fff",
    borderRadius: 18,
    paddingVertical: 22,
    paddingHorizontal: 18,
    borderWidth: 2,
    borderColor: "#E8DDD0",
    shadowColor: "#4A3829",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  roleCardSelected: {
    borderColor: "#8B1A1A",
    backgroundColor: "#FFF8F0",
    shadowColor: "#8B1A1A",
    shadowOpacity: 0.14,
    elevation: 5,
  },
  cardIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "#F5EFE8",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  cardIconWrapSelected: {
    backgroundColor: "rgba(139,26,26,0.1)",
  },
  cardIconEmoji: {
    fontSize: 26,
  },
  cardBody: {
    flex: 1,
    gap: 5,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#2A1005",
  },
  cardTitleSelected: {
    color: "#8B1A1A",
  },
  cardDesc: {
    fontSize: 12,
    color: COLORS.text.muted,
    lineHeight: 17,
  },
  cardRadio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#D0C4B8",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  cardRadioSelected: {
    borderColor: "#8B1A1A",
  },
  cardRadioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#8B1A1A",
  },

  // Bottom actions
  bottomActions: {
    gap: 12,
  },
  primaryBtn: {
    backgroundColor: "#C9A84C",
    borderRadius: 14,
    paddingVertical: 17,
    alignItems: "center",
    elevation: 4,
    shadowColor: "#C9A84C",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  btnDisabled: {
    backgroundColor: "#DDD4C8",
  },
  primaryBtnText: {
    color: "#1A0505",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  primaryBtnTextDisabled: {
    color: "#A09080",
  },
  backRow: {
    alignItems: "center",
    paddingVertical: 2,
  },
  backText: {
    fontSize: 13,
    color: COLORS.text.muted,
    fontWeight: "500",
  },
});

const webStyles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#FAF7F2",
  },
  nav: {
    height: 72,
    paddingHorizontal: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#EDE0D4",
  },
  brand: {
    fontSize: 18,
    fontWeight: "800",
    color: "#2A1005",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    gap: 16,
  },
  title: {
    fontSize: 36,
    fontWeight: "800",
    color: "#2A1005",
    textAlign: "center",
  },
  sub: {
    color: "#6B5946",
    fontSize: 16,
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    gap: 16,
    width: "100%",
    maxWidth: 820,
  },
  choice: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "#EDE0D4",
    padding: 24,
    gap: 8,
    minHeight: 180,
  },
  choiceOn: {
    borderColor: "#8B1A1A",
    backgroundColor: "#FFF8F4",
  },
  choiceTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#2A1005",
  },
  choiceBody: {
    color: "#6B5946",
    fontSize: 15,
    lineHeight: 22,
  },
  continue: {
    marginTop: 8,
    backgroundColor: "#8B1A1A",
    borderRadius: 12,
    paddingHorizontal: 28,
    paddingVertical: 14,
  },
  continueOff: {
    backgroundColor: "#C4B5A0",
  },
  continueText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 15,
  },
  back: {
    color: "#6B5946",
    fontWeight: "700",
  },
});
