import { useEffect, useRef } from "react";
import { Animated, Platform, StyleSheet } from "react-native";
import LikharrioLogo from "../ui/LikharrioLogo";

type Props = {
  onFinish: () => void;
};

export default function AnimatedSplash({ onFinish }: Props) {
  const scale = useRef(new Animated.Value(0.72)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const tagline = useRef(new Animated.Value(0)).current;
  const exit = useRef(new Animated.Value(1)).current;
  const native = Platform.OS !== "web";
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

  useEffect(() => {
    const animation = Animated.sequence([
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, friction: 6, tension: 70, useNativeDriver: native }),
        Animated.timing(fade, { toValue: 1, duration: 450, useNativeDriver: native }),
      ]),
      Animated.timing(tagline, { toValue: 1, duration: 350, useNativeDriver: native }),
      Animated.delay(550),
      Animated.timing(exit, { toValue: 0, duration: 380, useNativeDriver: native }),
    ]);
    animation.start(({ finished }) => {
      if (finished) onFinishRef.current();
    });
    return () => animation.stop();
  }, [exit, fade, native, scale, tagline]);

  return (
    <Animated.View style={[styles.screen, { opacity: exit }]} pointerEvents="auto">
      <Animated.View style={{ opacity: fade, transform: [{ scale }] }}>
        <LikharrioLogo size={128} variant="dark" showWordmark showTagline={false} />
      </Animated.View>
      <Animated.Text style={[styles.tagline, { opacity: tagline }]}>
        CORDILLERAN ART & CREATIVITY
      </Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
    backgroundColor: "#1A0505",
    alignItems: "center",
    justifyContent: "center",
  },
  tagline: {
    marginTop: 14,
    color: "rgba(250,247,242,0.62)",
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 2.4,
  },
});
