import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Rect, Circle } from 'react-native-svg';
import COLORS from '../../constants/Colors';

interface LikharrioLogoProps {
  size?: number;       // controls the shield height
  variant?: 'light' | 'dark'; // light = red shield on white bg, dark = for dark backgrounds
  showWordmark?: boolean;
  showTagline?: boolean;
}

export default function LikharrioLogo({
  size = 100,
  variant = 'light',
  showWordmark = true,
  showTagline = true,
}: LikharrioLogoProps) {
  const shieldColor = COLORS.primary.deepRed;   // #8B1A1A
  const gold = '#C9A84C';
  const white = '#FFFFFF';
  const wordmarkColor = variant === 'dark' ? '#FAF7F2' : COLORS.text.primary;
  const taglineColor = variant === 'dark' ? 'rgba(250,247,242,0.5)' : '#999';

  // Shield viewBox is 80x90, so aspect ratio = 80/90
  const shieldW = size * (80 / 90);
  const shieldH = size;

  return (
    <View style={styles.wrapper}>
      {/* Shield Mark */}
      <Svg width={shieldW} height={shieldH} viewBox="0 0 80 90">
        {/* Shield shape */}
        <Path
          d="M40 2 L76 18 L76 58 Q76 78 40 88 Q4 78 4 58 L4 18 Z"
          fill={shieldColor}
        />

        {/* The bold "L" letterform */}
        {/* Vertical stroke of L */}
        <Rect x="20" y="20" width="11" height="46" rx="2" fill={white}/>
        {/* Horizontal base of L */}
        <Rect x="20" y="55" width="38" height="11" rx="2" fill={white}/>

        {/* Gold accent dot — top right, like a star/creator spark */}
        <Circle cx="57" cy="24" r="6" fill={gold}/>
        {/* Small white center in gold dot */}
        <Circle cx="57" cy="24" r="2.5" fill={white} opacity="0.6"/>
      </Svg>

      {/* Wordmark */}
      {showWordmark && (
        <Text style={[styles.wordmark, { color: wordmarkColor, fontSize: size * 0.26 }]}>
          Likharrio
        </Text>
      )}

      {/* Tagline */}
      {showTagline && (
        <Text style={[styles.tagline, { color: taglineColor, fontSize: size * 0.11 }]}>
          CORDILLERAN ART & CREATIVITY
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    gap: 10,
  },
  wordmark: {
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  tagline: {
    letterSpacing: 2.5,
    fontWeight: '500',
  },
});
