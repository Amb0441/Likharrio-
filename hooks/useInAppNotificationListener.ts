import { useEffect, useRef } from 'react';
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { useRouter } from 'expo-router';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useInAppNotification, InAppNotificationPayload } from '../contexts/InAppNotificationContext';

/**
 * Drop this hook anywhere inside InAppNotificationProvider.
 * It listens for brand-new (unread) Firestore notifications and fires
 * the in-app toast automatically — without needing each screen to do anything.
 */
export function useInAppNotificationListener() {
  const { user } = useAuth();
  const { showNotification } = useInAppNotification();
  const router = useRouter();

  // Track which notification IDs we've already seen so we only toast NEW ones
  const seenIds = useRef<Set<string>>(new Set());
  const initialized = useRef(false);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      where('read', '==', false),
      orderBy('createdAt', 'desc'),
      limit(50), // cap: toast listener only needs the latest 50 unread
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      // On the very first snapshot, just record existing IDs — don't toast them
      if (!initialized.current) {
        snapshot.docs.forEach((d) => seenIds.current.add(d.id));
        initialized.current = true;
        return;
      }

      // For subsequent snapshots, find docs we haven't seen yet
      snapshot.docChanges().forEach((change) => {
        if (change.type !== 'added') return;
        const doc = change.doc;
        if (seenIds.current.has(doc.id)) return;

        seenIds.current.add(doc.id);
        const data = doc.data();

        const payload: InAppNotificationPayload = {
          type: data.type,
          title: data.title,
          body: data.body,
          imageUrl: data.imageUrl || undefined,
          onPress: () => navigateFromNotification(data, router),
        };

        showNotification(payload);
      });
    });

    return () => {
      unsubscribe();
      initialized.current = false;
      seenIds.current.clear();
    };
  }, [user]);
}

// ─────────────────────────────────────────────
// Navigate to the relevant screen when toast is tapped
// ─────────────────────────────────────────────
function navigateFromNotification(data: any, router: any) {
  switch (data.type) {
    case 'message':
      if (data.targetId) {
        router.push({ pathname: '/(app)/chat/detail', params: { id: data.targetId } });
      } else {
        router.push('/(app)/chat');
      }
      break;
    case 'follow':
      if (data.fromUserId) {
        router.push({ pathname: '/(app)/artist/artist-profile-view', params: { id: data.fromUserId } });
      }
      break;
    case 'like':
    case 'comment':
      if (data.targetType === 'portfolio' && data.targetId) {
        router.push({ pathname: '/(app)/showcase/showcase-detail', params: { id: data.targetId } });
      } else if (data.targetId) {
        router.push({ pathname: '/(app)/marketplace/listing-details', params: { id: data.targetId } });
      }
      break;
    case 'sale':
    case 'listing':
      if (data.targetId) {
        router.push({ pathname: '/(app)/marketplace/listing-details', params: { id: data.targetId } });
      }
      break;
    case 'portfolio':
      if (data.targetId) {
        router.push({ pathname: '/(app)/showcase/showcase-detail', params: { id: data.targetId } });
      }
      break;
    case 'event':
      if (data.targetId) {
        router.push({ pathname: '/(app)/events/event-detail', params: { id: data.targetId } });
      }
      break;
  }
}
