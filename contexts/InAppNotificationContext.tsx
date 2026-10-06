import { createContext, useContext, useRef, useState, useEffect, ReactNode, useCallback } from 'react';
import {
  Animated,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import COLORS from '../constants/Colors';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
export interface InAppNotificationPayload {
  type: 'follow' | 'like' | 'comment' | 'message' | 'sale' | 'event' | 'listing' | 'portfolio' | 'system';
  title: string;
  body: string;
  imageUrl?: string;
  onPress?: () => void;
}

interface InAppNotificationContextValue {
  showNotification: (payload: InAppNotificationPayload) => void;
}

// ─────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────
const InAppNotificationContext = createContext<InAppNotificationContextValue>({
  showNotification: () => {},
});

export function useInAppNotification() {
  return useContext(InAppNotificationContext);
}

// ─────────────────────────────────────────────
// Icon map
// ─────────────────────────────────────────────
const ICON_MAP: Record<string, { name: any; color: string }> = {
  follow:    { name: 'person-add',   color: '#4ECDC4' },
  like:      { name: 'heart',        color: '#FF6B6B' },
  comment:   { name: 'chatbubble',   color: '#45B7D1' },
  message:   { name: 'mail',         color: '#FFA07A' },
  sale:      { name: 'cash',         color: '#34C759' },
  event:     { name: 'calendar',     color: '#FF9500' },
  listing:   { name: 'pricetag',     color: '#5856D6' },
  portfolio: { name: 'images',       color: '#AF52DE' },
};

// ─────────────────────────────────────────────
// Provider  (renders the toast + provides context)
// ─────────────────────────────────────────────
const BANNER_HEIGHT = 80;
const DURATION_MS   = 3500;
const ANIM_MS       = 350;

export function InAppNotificationProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState<InAppNotificationPayload | null>(null);
  const translateY = useRef(new Animated.Value(-(BANNER_HEIGHT + 60))).current;
  const hideTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isShowing  = useRef(false);

  const dismiss = useCallback(() => {
    Animated.timing(translateY, {
      toValue: -(BANNER_HEIGHT + 60),
      duration: ANIM_MS,
      useNativeDriver: true,
    }).start(() => {
      setCurrent(null);
      isShowing.current = false;
    });
  }, [translateY]);

  const showNotification = useCallback((payload: InAppNotificationPayload) => {
    // Cancel any pending hide
    if (hideTimer.current) clearTimeout(hideTimer.current);

    // If already showing, snap back first then re-animate
    if (isShowing.current) {
      translateY.setValue(-(BANNER_HEIGHT + 60));
    }

    setCurrent(payload);
    isShowing.current = true;

    // Slide down
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      tension: 80,
      friction: 10,
    }).start();

    // Auto hide after DURATION_MS
    hideTimer.current = setTimeout(dismiss, DURATION_MS);
  }, [translateY, dismiss]);

  const icon = current ? (ICON_MAP[current.type] ?? { name: 'notifications', color: COLORS.primary.deepRed }) : null;
  const topOffset = insets.top > 0 ? insets.top : (Platform.OS === 'ios' ? 44 : 24);

  return (
    <InAppNotificationContext.Provider value={{ showNotification }}>
      {children}

      {/* ── Toast Banner ── */}
      {current && icon && (
        <Animated.View
          style={[
            styles.banner,
            { top: topOffset + 8, transform: [{ translateY }] },
          ]}
          pointerEvents="box-none"
        >
          <TouchableOpacity
            style={styles.inner}
            activeOpacity={0.92}
            onPress={() => {
              if (hideTimer.current) clearTimeout(hideTimer.current);
              dismiss();
              current.onPress?.();
            }}
          >
            {/* Left: type icon or image */}
            <View style={[styles.iconWrap, { backgroundColor: `${icon.color}20` }]}>
              {current.imageUrl ? (
                <Image source={{ uri: current.imageUrl }} style={styles.avatarImg} />
              ) : (
                <Ionicons name={icon.name} size={22} color={icon.color} />
              )}
            </View>

            {/* Middle: title + body */}
            <View style={styles.textWrap}>
              <Text style={styles.title} numberOfLines={1}>{current.title}</Text>
              <Text style={styles.body}  numberOfLines={2}>{current.body}</Text>
            </View>

            {/* Right: dismiss */}
            <TouchableOpacity
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              onPress={() => {
                if (hideTimer.current) clearTimeout(hideTimer.current);
                dismiss();
              }}
            >
              <Ionicons name="close" size={18} color="#999" />
            </TouchableOpacity>
          </TouchableOpacity>

          {/* Progress bar */}
          <ProgressBar durationMs={DURATION_MS} color={icon.color} />
        </Animated.View>
      )}
    </InAppNotificationContext.Provider>
  );
}

// ─────────────────────────────────────────────
// Thin animated progress bar at bottom of toast
// ─────────────────────────────────────────────
function ProgressBar({ durationMs, color }: { durationMs: number; color: string }) {
  const width = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    width.setValue(1);
    Animated.timing(width, {
      toValue: 0,
      duration: durationMs,
      useNativeDriver: false,
    }).start();
  }, []);

  return (
    <View style={styles.progressTrack}>
      <Animated.View
        style={[
          styles.progressBar,
          { backgroundColor: color, flex: width },
        ]}
      />
    </View>
  );
}

// ─────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────
const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 9999,
    elevation: 20,
    borderRadius: 16,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    overflow: 'hidden',
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  avatarImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  textWrap: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111',
  },
  body: {
    fontSize: 13,
    color: '#555',
    lineHeight: 17,
  },
  progressTrack: {
    height: 3,
    backgroundColor: '#f0f0f0',
    flexDirection: 'row',
  },
  progressBar: {
    height: 3,
    borderRadius: 2,
  },
});
