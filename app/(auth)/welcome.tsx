import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import LikharrioLogo from "../../components/ui/LikharrioLogo";
import WebWelcome from "../../components/web/WebWelcome";
import { useLayoutMode } from "../../hooks/useLayoutMode";
import COLORS from "../../constants/Colors";
import { useAuth } from "../../contexts/AuthContext";

// ── Textile pattern decoration ──
function TextilePattern({ fadeAnim }: { fadeAnim: Animated.Value }) {
  const positions = [
    { left: -20, top: -20 }, { left: 44, top: -20 }, { left: 108, top: -20 },
    { left: 172, top: -20 }, { left: 236, top: -20 }, { left: 300, top: -20 },
    { left: 12,  top:  44 }, { left: 76,  top:  44 }, { left: 140, top:  44 },
    { left: 204, top:  44 }, { left: 268, top:  44 }, { left: 332, top:  44 },
    { left: -20, top: 108 }, { left: 44,  top: 108 }, { left: 108, top: 108 },
    { left: 172, top: 108 }, { left: 236, top: 108 }, { left: 300, top: 108 },
    { left: 12,  top: 172 }, { left: 76,  top: 172 }, { left: 140, top: 172 },
    { left: 204, top: 172 }, { left: 268, top: 172 }, { left: 332, top: 172 },
  ];
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: fadeAnim }]} pointerEvents="none">
      {positions.map((pos, i) => (
        <View key={i} style={[patternStyles.diamond, { left: pos.left, top: pos.top }]} />
      ))}
    </Animated.View>
  );
}

// ── Individual letter for staggered wordmark reveal ──
function AnimatedLetter({ char, delay }: { char: string; delay: number }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.spring(anim, {
        toValue: 1,
        tension: 120,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.Text
      style={[
        styles.wordmarkLetter,
        {
          opacity: anim,
          transform: [
            {
              translateY: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [20, 0],
              }),
            },
            {
              scale: anim.interpolate({
                inputRange: [0, 0.6, 1],
                outputRange: [0.6, 1.1, 1],
              }),
            },
          ],
        },
      ]}
    >
      {char}
    </Animated.Text>
  );
}

const WORDMARK = "Likharrio".split("");

export default function Welcome() {
  const router = useRouter();
  const { setGuestMode } = useAuth();
  const { isWebsite } = useLayoutMode();

  // ── Phase 1 anims ──
  const shieldAnim     = useRef(new Animated.Value(0)).current;
  const shieldGlowAnim = useRef(new Animated.Value(0)).current;
  const taglineAnim    = useRef(new Animated.Value(0)).current;
  const arc1Anim       = useRef(new Animated.Value(0)).current;
  const arc2Anim       = useRef(new Animated.Value(0)).current;
  const arc3Anim       = useRef(new Animated.Value(0)).current;
  const patternAnim    = useRef(new Animated.Value(0)).current;
  const dot1Anim       = useRef(new Animated.Value(0)).current;
  const dot2Anim       = useRef(new Animated.Value(0)).current;
  const dot3Anim       = useRef(new Animated.Value(0)).current;
  const dotWaveAnim    = useRef(new Animated.Value(0)).current;

  // ── Phase 2 anims ──
  const logoShiftAnim  = useRef(new Animated.Value(0)).current;
  const panelAnim      = useRef(new Animated.Value(500)).current;
  const panelFadeAnim  = useRef(new Animated.Value(0)).current;
  const dotsExitAnim   = useRef(new Animated.Value(1)).current;
  const headingAnim    = useRef(new Animated.Value(0)).current;
  const btn1Anim       = useRef(new Animated.Value(0)).current;
  const btn2Anim       = useRef(new Animated.Value(0)).current;
  const btn3Anim       = useRef(new Animated.Value(0)).current;
  const btn4Anim       = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isWebsite) return;
    // ── Shield drops in with big overshoot ──
    Animated.sequence([
      Animated.delay(80),
      Animated.spring(shieldAnim, {
        toValue: 1,
        tension: 35,
        friction: 6,
        useNativeDriver: true,
      }),
    ]).start();

    // ── Gold glow pulses once after shield lands ──
    Animated.sequence([
      Animated.delay(500),
      Animated.timing(shieldGlowAnim, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(shieldGlowAnim, {
        toValue: 0,
        duration: 600,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();

    // ── Rings expand outward from shield sequentially ──
    Animated.sequence([
      Animated.delay(300),
      Animated.timing(arc1Anim, {
        toValue: 1,
        duration: 500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    Animated.sequence([
      Animated.delay(450),
      Animated.timing(arc2Anim, {
        toValue: 1,
        duration: 500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    Animated.sequence([
      Animated.delay(600),
      Animated.timing(arc3Anim, {
        toValue: 1,
        duration: 500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    // ── Pattern fades in ──
    Animated.sequence([
      Animated.delay(400),
      Animated.timing(patternAnim, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();

    // ── Tagline sweeps in ──
    Animated.sequence([
      Animated.delay(780),
      Animated.timing(taglineAnim, {
        toValue: 1,
        duration: 450,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    // ── Dots bounce in then wave continuously ──
    Animated.sequence([
      Animated.delay(900),
      Animated.stagger(100, [
        Animated.spring(dot1Anim, { toValue: 1, tension: 120, friction: 5, useNativeDriver: true }),
        Animated.spring(dot2Anim, { toValue: 1, tension: 120, friction: 5, useNativeDriver: true }),
        Animated.spring(dot3Anim, { toValue: 1, tension: 120, friction: 5, useNativeDriver: true }),
      ]),
    ]).start(() => {
      // Continuous wave after all dots in
      Animated.loop(
        Animated.sequence([
          Animated.timing(dotWaveAnim, {
            toValue: 1,
            duration: 600,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(dotWaveAnim, {
            toValue: 0,
            duration: 600,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      ).start();
    });

    // ── Phase 2: dramatic reveal after hold ──
    Animated.sequence([
      Animated.delay(2200),
      Animated.parallel([
        // Dots exit
        Animated.timing(dotsExitAnim, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
        // Logo surges upward
        Animated.spring(logoShiftAnim, {
          toValue: 1,
          tension: 38,
          friction: 9,
          useNativeDriver: true,
        }),
        // Panel slams up with big overshoot
        Animated.spring(panelAnim, {
          toValue: 0,
          tension: 42,
          friction: 8,
          useNativeDriver: true,
        }),
        // Panel fades in
        Animated.timing(panelFadeAnim, {
          toValue: 1,
          duration: 300,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    // ── Panel content staggers in after panel lands ──
    const contentDelay = 2500;
    Animated.sequence([
      Animated.delay(contentDelay),
      Animated.spring(headingAnim, { toValue: 1, tension: 80, friction: 10, useNativeDriver: true }),
    ]).start();

    Animated.sequence([
      Animated.delay(contentDelay + 80),
      Animated.spring(btn1Anim, { toValue: 1, tension: 80, friction: 10, useNativeDriver: true }),
    ]).start();

    Animated.sequence([
      Animated.delay(contentDelay + 160),
      Animated.spring(btn2Anim, { toValue: 1, tension: 80, friction: 10, useNativeDriver: true }),
    ]).start();

    Animated.sequence([
      Animated.delay(contentDelay + 240),
      Animated.spring(btn3Anim, { toValue: 1, tension: 80, friction: 10, useNativeDriver: true }),
    ]).start();

    Animated.sequence([
      Animated.delay(contentDelay + 320),
      Animated.spring(btn4Anim, { toValue: 1, tension: 80, friction: 10, useNativeDriver: true }),
    ]).start();
  }, []);

  // ── Derived styles ──
  const shieldStyle = {
    opacity: shieldAnim,
    transform: [
      {
        translateY: shieldAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [-80, 0],
        }),
      },
      {
        scale: shieldAnim.interpolate({
          inputRange: [0, 0.5, 0.8, 1],
          outputRange: [0.4, 1.15, 0.95, 1],
        }),
      },
    ],
  };

  const shieldGlowStyle = {
    opacity: shieldGlowAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 0.6],
    }),
    transform: [
      {
        scale: shieldGlowAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 1.4],
        }),
      },
    ],
  };

  const makeArcStyle = (anim: Animated.Value, maxScale: number) => ({
    opacity: anim.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0.8, 0] }),
    transform: [
      {
        scale: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0.2, maxScale],
        }),
      },
    ],
  });

  const taglineStyle = {
    opacity: taglineAnim,
    transform: [
      {
        translateX: taglineAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [-30, 0],
        }),
      },
    ],
  };

  const logoContainerStyle = {
    transform: [
      {
        translateY: logoShiftAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -50],
        }),
      },
    ],
  };

  // Dot wave — each offset by 1/3 cycle
  const makeDotStyle = (enterAnim: Animated.Value, waveOffset: number) => ({
    opacity: Animated.multiply(enterAnim, dotsExitAnim),
    transform: [
      {
        translateY: dotWaveAnim.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [
            waveOffset === 0 ? 0 : waveOffset === 1 ? -4 : -8,
            waveOffset === 0 ? -8 : waveOffset === 1 ? -8 : -4,
            waveOffset === 0 ? 0 : waveOffset === 1 ? -4 : 0,
          ],
        }),
      },
      {
        scale: enterAnim.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [0.3, 1.15, 1],
        }),
      },
    ],
  });

  const contentFade = (anim: Animated.Value) => ({
    opacity: anim,
    transform: [
      {
        translateY: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [16, 0],
        }),
      },
    ],
  });

  if (isWebsite) {
    return (
      <WebWelcome
        onSignIn={() => router.push("/(auth)/login")}
        onCreateAccount={() => router.push("/(auth)/role-selection")}
        onGuest={() => {
          setGuestMode(true);
          router.push("/(app)/enthusiast/enthusiast-home");
        }}
      />
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />

      {/* Background layers */}
      <View style={styles.bgBase} />
      <View style={styles.bgMid} />
      <View style={styles.bgTop} />
      <TextilePattern fadeAnim={patternAnim} />
      <View style={styles.arcOuter} pointerEvents="none" />
      <View style={styles.arcInner} pointerEvents="none" />
      <View style={styles.bottomBand} pointerEvents="none" />

      {/* Hero */}
      <Animated.View style={[styles.hero, logoContainerStyle]}>

        {/* Expanding ripple rings from shield */}
        <View style={styles.ringsWrap} pointerEvents="none">
          <Animated.View style={[styles.ring, makeArcStyle(arc1Anim, 2.2)]} />
          <Animated.View style={[styles.ring, makeArcStyle(arc2Anim, 3.0)]} />
          <Animated.View style={[styles.ring, makeArcStyle(arc3Anim, 3.8)]} />
        </View>

        {/* Gold glow behind shield */}
        <Animated.View style={[styles.shieldGlow, shieldGlowStyle]} pointerEvents="none" />

        {/* Shield */}
        <Animated.View style={[styles.logoWrap, shieldStyle]}>
          <LikharrioLogo size={110} variant="dark" showWordmark={false} showTagline={false} />
        </Animated.View>

        {/* Letter-by-letter wordmark */}
        <View style={styles.wordmarkRow}>
          {WORDMARK.map((char, i) => (
            <AnimatedLetter
              key={i}
              char={char}
              delay={380 + i * 55}
            />
          ))}
        </View>

        {/* Tagline sweeps in from left */}
        <Animated.View style={[styles.taglineBlock, taglineStyle]}>
          <View style={styles.taglineLine} />
          <Text style={styles.taglineText}>CORDILLERAN ART & CREATIVITY</Text>
          <View style={styles.taglineLine} />
        </Animated.View>

        {/* Waving loading dots */}
        <Animated.View style={[styles.dotsRow, { opacity: dotsExitAnim }]}>
          <Animated.View style={[styles.dot, makeDotStyle(dot1Anim, 0)]} />
          <Animated.View style={[styles.dot, makeDotStyle(dot2Anim, 1)]} />
          <Animated.View style={[styles.dot, makeDotStyle(dot3Anim, 2)]} />
        </Animated.View>
      </Animated.View>

      {/* Panel slams up from bottom */}
      <Animated.View
        style={[
          styles.panel,
          { opacity: panelFadeAnim, transform: [{ translateY: panelAnim }] },
        ]}
      >
        {/* Heading */}
        <Animated.Text style={[styles.panelHeading, contentFade(headingAnim)]}>
          Join the community
        </Animated.Text>

        {/* Sign In */}
        <Animated.View style={contentFade(btn2Anim)}>
          <TouchableOpacity
            style={styles.signInBtn}
            onPress={() => router.push("/(auth)/login")}
            activeOpacity={0.82}
          >
            <Text style={styles.signInBtnText}>Sign In</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Create Account */}
        <Animated.View style={contentFade(btn3Anim)}>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => router.push("/(auth)/role-selection")}
            activeOpacity={0.82}
          >
            <Text style={styles.primaryBtnText}>Create Account</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Guest */}
        <Animated.View style={[styles.guestRow, contentFade(btn4Anim)]}>
          <TouchableOpacity
            style={styles.guestBtn}
            onPress={() => {
              setGuestMode(true);
              router.push("/(app)/enthusiast/enthusiast-home");
            }}
            activeOpacity={0.82}
          >
            <Text style={styles.guestBtnText}>Browse as Guest</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
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
    height: "65%",
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
    height: "35%",
    backgroundColor: "#7A1212",
    opacity: 0.55,
    borderTopLeftRadius: 200,
  },
  arcOuter: {
    position: "absolute",
    top: -90,
    right: -90,
    width: 280,
    height: 280,
    borderRadius: 140,
    borderWidth: 1.5,
    borderColor: "rgba(201,168,76,0.14)",
  },
  arcInner: {
    position: "absolute",
    top: -52,
    right: -52,
    width: 190,
    height: 190,
    borderRadius: 95,
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
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
    gap: 14,
  },

  // Ripple rings
  ringsWrap: {
    position: "absolute",
    width: 120,
    height: 120,
    justifyContent: "center",
    alignItems: "center",
  },
  ring: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 1.5,
    borderColor: "rgba(201,168,76,0.5)",
  },

  // Gold glow
  shieldGlow: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(201,168,76,0.25)",
  },

  // Logo
  logoWrap: {
    alignItems: "center",
  },

  // Letter-by-letter wordmark
  wordmarkRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  wordmarkLetter: {
    fontSize: 36,
    fontWeight: "800",
    color: "#FAF3E8",
    letterSpacing: 0.5,
  },

  // Tagline
  taglineBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  taglineLine: {
    width: 48,
    height: 1,
    backgroundColor: "rgba(201,168,76,0.4)",
  },
  taglineText: {
    color: "rgba(201,168,76,0.85)",
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 3,
  },

  // Loading dots
  dotsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 20,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "rgba(201,168,76,0.7)",
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 18,
  },
  panelHeading: {
    fontSize: 20,
    fontWeight: "800",
    color: "#2A1005",
    letterSpacing: 0.3,
    marginBottom: 4,
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
    color: "#8B7355",
    fontWeight: "500",
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
    letterSpacing: 0.4,
  },
  signInBtn: {
    backgroundColor: "#8B1A1A",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    elevation: 4,
    shadowColor: "#8B1A1A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  signInBtnText: {
    color: "#FAF3E8",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.4,
  },

  // Guest
  guestRow: {
    paddingTop: 2,
  },
  guestBtn: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#3D2B1F",
    borderRadius: 14,
    paddingVertical: 16,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
  },
  guestBtnText: {
    color: "#C4A882",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
});
