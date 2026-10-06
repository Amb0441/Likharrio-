import * as Notifications from 'expo-notifications';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import COLORS from '../../constants/Colors';

interface ToastData {
  title: string;
  body: string;
  type?: string;
}

const TYPE_ICONS: Record<string, string> = {
  like:      '❤️',
  comment:   '💬',
  follow:    '🎉',
  message:   '💬',
  sale:      '💰',
  listing:   '🎨',
  portfolio: '🖼️',
  event:     '📅',
};

// Android version-safe top offset
const ANDROID_VERSION = Platform.OS === 'android' ? (Platform.Version as number) : 0;
const STATUS_BAR_HEIGHT = Platform.OS === 'android'
  ? (StatusBar.currentHeight || (ANDROID_VERSION >= 28 ? 28 : 24))
  : 0;

export default function InAppNotificationToast() {
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<ToastData | null>(null);
  const slideAnim = useRef(new Animated.Value(-120)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener((notification) => {
      const { title, body, data } = notification.request.content;
      showToast({
        title: title || 'Likharrio',
        body: body || '',
        type: (data as any)?.type,
      });
    });

    return () => subscription.remove();
  }, []);

  const showToast = (data: ToastData) => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setToast(data);

    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 80,
        friction: 10,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();

    hideTimer.current = setTimeout(() => hideToast(), 4000);
  };

  const hideToast = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -120,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => setToast(null));
  };

  if (!toast) return null;

  const icon = TYPE_ICONS[toast.type || ''] || '🔔';

  // Use safe area insets on iOS; use status bar height on Android
  const topOffset = Platform.OS === 'ios'
    ? insets.top + 8
    : STATUS_BAR_HEIGHT + 8;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          top: topOffset,
          transform: [{ translateY: slideAnim }],
          opacity: opacityAnim,
        },
      ]}
    >
      <TouchableOpacity style={styles.toast} onPress={hideToast} activeOpacity={0.95}>
        <View style={styles.accentBar} />

        <View style={styles.iconWrap}>
          <Text style={styles.icon}>{icon}</Text>
        </View>

        <View style={styles.textWrap}>
          <Text style={styles.title} numberOfLines={1}>{toast.title}</Text>
          {toast.body ? <Text style={styles.body} numberOfLines={2}>{toast.body}</Text> : null}
        </View>

        <TouchableOpacity
          onPress={hideToast}
          style={styles.closeBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 9999,
    elevation: 9999,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 14,
    paddingRight: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: COLORS.border.light,
    overflow: 'hidden',
  },
  accentBar: {
    width: 4,
    alignSelf: 'stretch',
    backgroundColor: COLORS.primary.deepRed,
    borderRadius: 2,
    marginRight: 12,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.background.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  icon: { fontSize: 20 },
  textWrap: { flex: 1, justifyContent: 'center' },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text.primary,
    marginBottom: 2,
  },
  body: {
    fontSize: 13,
    color: COLORS.text.secondary,
    lineHeight: 18,
  },
  closeBtn: { marginLeft: 8, padding: 4 },
  closeText: { fontSize: 13, color: COLORS.text.muted },
});
