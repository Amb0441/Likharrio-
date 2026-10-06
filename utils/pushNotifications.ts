import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { doc, setDoc } from 'firebase/firestore';
import { Alert, Platform } from 'react-native';
import { db } from '../lib/firebase';

const ANDROID_VERSION = Platform.OS === 'android' ? (Platform.Version as number) : 0;

export async function registerForPushNotifications(userId: string): Promise<string | null> {
  console.log('🔔 [PUSH] Starting registration for user:', userId);
  console.log('🔔 [PUSH] Platform:', Platform.OS, '| Android version:', ANDROID_VERSION);
  console.log('🔔 [PUSH] isDevice:', Device.isDevice);

  try {
    // ── Step 1: Must be a real device ─────────────────────────────────────
    if (!Device.isDevice) {
      console.warn('🔔 [PUSH] ❌ Not a physical device — emulators cannot receive push notifications');
      return null;
    }

    // ── Step 2: Create notification channels (Android 8+ only) ────────────
    if (Platform.OS === 'android' && ANDROID_VERSION >= 26) {
      console.log('🔔 [PUSH] Creating Android notification channels...');

      await Notifications.setNotificationChannelAsync('default', {
        name: 'Likharrio',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#8B1A1A',
        sound: 'default',
        showBadge: true,
        enableLights: true,
        enableVibrate: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });

      await Notifications.setNotificationChannelAsync('messages', {
        name: 'Messages',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        sound: 'default',
        showBadge: true,
        enableLights: true,
        enableVibrate: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });

      await Notifications.setNotificationChannelAsync('sales', {
        name: 'Sales & Transactions',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 500, 250, 500],
        lightColor: '#2D5016',
        sound: 'default',
        showBadge: true,
        enableLights: true,
        enableVibrate: true,
      });

      await Notifications.setNotificationChannelAsync('social', {
        name: 'Likes, Comments & Follows',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250],
        sound: 'default',
        showBadge: true,
        enableVibrate: true,
      });

      console.log('🔔 [PUSH] ✅ Notification channels created');
    }

    // ── Step 3: Check current permission status ────────────────────────────
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    console.log('🔔 [PUSH] Existing permission status:', existingStatus);

    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      console.log('🔔 [PUSH] Permission not granted yet, requesting...');

      // Android 13+ (API 33+) requires explicit permission request
      // Android 12 and below — auto granted, but we still call requestPermissionsAsync
      // to be safe across all versions
      const { status } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
        },
      });

      finalStatus = status;
      console.log('🔔 [PUSH] Permission status after request:', finalStatus);
    }

    // Android < 13 auto-grants even if status shows undetermined
    const isGranted =
      finalStatus === 'granted' ||
      (Platform.OS === 'android' && ANDROID_VERSION < 33);

    console.log('🔔 [PUSH] Is granted:', isGranted, '| finalStatus:', finalStatus);

    if (!isGranted) {
      console.warn('🔔 [PUSH] ❌ Permission denied by user');
      Alert.alert(
        'Notifications Disabled',
        'To receive notifications, go to Settings → Apps → Likharrio → Notifications and enable them.',
        [{ text: 'OK' }]
      );
      return null;
    }

    // ── Step 4: Get Expo push token ────────────────────────────────────────
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      Constants?.easConfig?.projectId ??
      '1ac61128-7f8a-4013-8ef9-880dd58ca7f8';

    console.log('🔔 [PUSH] Getting token with projectId:', projectId);

    let token: string | null = null;

    try {
      const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
      token = tokenResponse.data;
      console.log('🔔 [PUSH] ✅ Token received:', token);
    } catch (tokenError: any) {
      console.error('🔔 [PUSH] ❌ Failed to get token:', tokenError?.message);
      // Common causes:
      // - Push is unavailable in the browser
      // - FCM not linked in an Android build
      // - Running in Expo Go (not a dev build)
      return null;
    }

    if (!token) {
      console.error('🔔 [PUSH] ❌ Token is empty');
      return null;
    }

    // ── Step 5: Save to Firestore ──────────────────────────────────────────
    console.log('🔔 [PUSH] Saving token to Firestore...');

    await setDoc(
      doc(db, 'users', userId),
      {
        expoPushToken: token,
        pushPlatform: Platform.OS,
        pushAndroidVersion: ANDROID_VERSION,
        pushTokenUpdatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    console.log('🔔 [PUSH] ✅ Token saved to Firestore successfully');
    return token;

  } catch (error: any) {
    console.error('🔔 [PUSH] ❌ FATAL ERROR:', error?.message || error);
    return null;
  }
}

// ── Channel selector ──────────────────────────────────────────────────────────
function getChannelId(type?: string): string {
  if (type === 'message') return 'messages';
  if (type === 'sale') return 'sales';
  if (['like', 'comment', 'follow'].includes(type || '')) return 'social';
  return 'default';
}

// In-memory cache for push tokens to avoid repeated Firestore reads
const pushTokenCache = new Map<string, string>();

// ── Send push notification via Expo Push API ──────────────────────────────────
export async function sendPushNotification(
  targetUserId: string,
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<void> {
  try {
    // Check cache first — avoids a Firestore read on every notification
    let token = pushTokenCache.get(targetUserId);

    if (!token) {
      const { getDoc } = await import('firebase/firestore');
      const userSnap = await getDoc(doc(db, 'users', targetUserId));

      if (!userSnap.exists()) {
        console.warn('📤 [PUSH] User doc not found:', targetUserId);
        return;
      }

      const fetchedToken = userSnap.data()?.expoPushToken;
      if (!fetchedToken) {
        console.warn('📤 [PUSH] No push token saved for user:', targetUserId);
        return;
      }

      // Cache for future calls (tokens rarely change)
      pushTokenCache.set(targetUserId, fetchedToken);
      token = fetchedToken;
    }

    const channelId = getChannelId(data?.type);

    const message = {
      to: token,
      sound: 'default',
      title,
      body,
      data: data || {},
      channelId,
      priority: 'high',
      badge: 1,
      ttl: 86400,
    };

    console.log('📤 [PUSH] Sending to:', targetUserId, '| channel:', channelId);

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();

    if (result?.data?.status === 'error') {
      console.error('📤 [PUSH] ❌ Expo API error:', result.data.message);
    } else {
      console.log('📤 [PUSH] ✅ Sent successfully:', JSON.stringify(result));
    }
  } catch (error: any) {
    console.error('📤 [PUSH] ❌ Failed to send:', error?.message || error);
  }
}
