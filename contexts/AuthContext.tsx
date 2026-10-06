import { type User, signOut as firebaseSignOut, onAuthStateChanged, deleteUser, reload } from "firebase/auth";
import { deleteField, doc, getDoc, onSnapshot, setDoc, updateDoc } from "firebase/firestore";
import { ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useRef } from "react";
import { Platform } from "react-native";
import { auth, db } from "../lib/firebase";
import { clearCache } from "../lib/dataCache";
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { useSessionStore, type SessionProfile } from "../stores/sessionStore";

type UserProfile = SessionProfile;

type AuthContextValue = {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  error: string | null;
  isGuestMode: boolean;
  emailVerified: boolean;
  accountDeleted: boolean;
  setGuestMode: (isGuest: boolean) => void;
  refreshUserProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

type AuthActions = Pick<AuthContextValue, "setGuestMode" | "refreshUserProfile" | "signOut">;

const AuthContext = createContext<AuthActions | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const patch = useSessionStore((state) => state.patch);

  // Holds the active Firestore profile listener so we can unsubscribe when user changes
  const profileUnsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (firebaseUser) => {
        if (firebaseUser) {
          console.log('✅ [AUTH] User logged in:', firebaseUser.email);

          // ── Verify the user's Firestore profile still exists ──
          // This handles the case where the app was reinstalled but Firebase Auth
          // persistence (AsyncStorage/Keychain) still holds a stale session token.
          const profileSnap = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (profileSnap.exists()) {
            const privateKeys = ['email', 'age', 'gender', 'phone', 'phoneNumber', 'address', 'usedReferralCode'] as const;
            const data = profileSnap.data();
            const present = privateKeys.filter((key) => data[key] !== undefined);
            if (present.length > 0) {
              const moved: Record<string, unknown> = {};
              const cleared: Record<string, ReturnType<typeof deleteField>> = {};
              for (const key of present) {
                moved[key] = data[key];
                cleared[key] = deleteField();
              }
              try {
                await setDoc(doc(db, 'users', firebaseUser.uid, 'private', 'account'), moved, { merge: true });
                await updateDoc(doc(db, 'users', firebaseUser.uid), cleared);
              } catch (moveError) {
                console.warn('Could not move private profile fields', moveError);
              }
            }
          }
          if (!profileSnap.exists()) {
            console.warn('⚠️ [AUTH] No Firestore profile found — stale session from reinstalled app. Signing out locally.');
            try {
              await ReactNativeAsyncStorage.clear();
              await firebaseSignOut(auth);
            } catch (e) {
              console.error('❌ [AUTH] Failed to clear stale session:', e);
            }
            patch({ user: null, userProfile: null, emailVerified: false, loading: false });
            return;
          }

          // Reload to get the latest emailVerified status from Firebase
          try { await reload(firebaseUser); } catch (_) {}
          // After reload, auth.currentUser has the fresh emailVerified value
          const freshUser = auth.currentUser ?? firebaseUser;
          patch({ user: freshUser, emailVerified: freshUser.emailVerified, isGuestMode: false });

          // Cancel any previous profile listener before starting a new one
          if (profileUnsubRef.current) {
            profileUnsubRef.current();
            profileUnsubRef.current = null;
          }
          subscribeToUserProfile(freshUser.uid);

          if (Platform.OS !== "web") {
            const { registerForPushNotifications } = require("../utils/pushNotifications") as typeof import("../utils/pushNotifications");
            registerForPushNotifications(firebaseUser.uid).catch((err: { message?: string }) => {
              console.error("❌ [AUTH] Push registration error:", err?.message || err);
            });
          }

        } else {
          // Cancel the real-time profile listener
          if (profileUnsubRef.current) {
            profileUnsubRef.current();
            profileUnsubRef.current = null;
          }
          patch({ user: null, userProfile: null, emailVerified: false });
        }
        patch({ loading: false, error: null });
      },
      (err) => {
        console.error('❌ [AUTH] Auth state error:', err);
        patch({ error: err.message, loading: false });
      }
    );
    return unsubscribe;
  }, []);

  // Real-time profile listener — auto-updates when Firestore changes (e.g. admin approves artist)
  const subscribeToUserProfile = (uid: string) => {
    const unsub = onSnapshot(
      doc(db, 'users', uid),
      async (snap) => {
        if (snap.exists()) {
          const data = snap.data();

          // ── Admin deleted this user — sign out immediately ──
          if (data.pendingDelete === true || data.disabled === true) {
            console.warn('⚠️ [AUTH] Account flagged for deletion by admin.');
            patch({ accountDeleted: true });
            try {
              const currentUser = auth.currentUser;
              if (currentUser) await deleteUser(currentUser);
            } catch (delErr) {
              console.error('❌ [AUTH] Failed to delete auth account:', delErr);
            }
            await firebaseSignOut(auth);
            patch({ user: null, userProfile: null });
            return;
          }

          // Suspension blocks the app without deleting the login, so an admin can restore it.
          patch({ accountDeleted: data.suspended === true });

          const profile = {
            uid: data.uid ?? uid,
            email: data.email ?? null,
            role: data.role ?? null,
            verified: data.verified ?? null,
            artistStatus: data.artistStatus ?? null,
            displayName: data.displayName ?? null,
            photoURL: data.photoURL ?? null,
          };

          patch({ userProfile: profile });
          console.log('✅ [AUTH] Profile updated — artistStatus:', data.artistStatus);

        } else {
          // Doc missing — could be a race condition during signup (Auth created but Firestore
          // setDoc hasn't completed yet). Wait 4s then re-check before treating as admin deletion.
          console.warn('⚠️ [AUTH] No user profile found — waiting to confirm it is not a signup race...');
          setTimeout(async () => {
            try {
              const recheckSnap = await getDoc(doc(db, 'users', uid));
              if (!recheckSnap.exists()) {
                // Still missing after grace period — genuinely deleted by admin
                console.warn('⚠️ [AUTH] Confirmed: no profile after grace period. Account deleted by admin.');
                patch({ accountDeleted: true });
                try {
                  const currentUser = auth.currentUser;
                  if (currentUser) await deleteUser(currentUser);
                } catch (delErr) {
                  console.error('❌ [AUTH] Failed to delete auth account:', delErr);
                }
                await firebaseSignOut(auth);
                patch({ user: null, userProfile: null });
              } else {
                console.log('✅ [AUTH] Profile found after grace period — signup race condition resolved.');
              }
            } catch (recheckErr) {
              console.error('❌ [AUTH] Re-check error:', recheckErr);
            }
          }, 4000);
        }
      },
      (err) => {
        console.error('❌ [AUTH] Profile listener error:', err);
      },
    );

    // Store unsubscribe so we can cancel it later
    profileUnsubRef.current = unsub;
  };

  const refreshUserProfile = useCallback(async () => {
    const currentUser = useSessionStore.getState().user;
    if (!currentUser) return;
    // Re-check emailVerified from Firebase
    try { await reload(currentUser); } catch (_) {}
    const freshUser = auth.currentUser ?? currentUser;
    patch({ user: freshUser, emailVerified: freshUser.emailVerified });
    // Re-subscribe to get the latest profile snapshot immediately
    if (profileUnsubRef.current) {
      profileUnsubRef.current();
      profileUnsubRef.current = null;
    }
    subscribeToUserProfile(freshUser.uid);
  }, [patch]);

  const setGuestMode = useCallback((isGuest: boolean) => {
    useSessionStore.getState().setGuestMode(isGuest);
  }, []);

  const signOut = useCallback(async () => {
    try {
      // Cancel real-time profile listener before signing out
      if (profileUnsubRef.current) {
        profileUnsubRef.current();
        profileUnsubRef.current = null;
      }
      await firebaseSignOut(auth);
      clearCache();
      useSessionStore.getState().reset();
      console.log('✅ [AUTH] Signed out');
    } catch (err) {
      console.error('❌ [AUTH] Sign out error:', err);
      throw err;
    }
  }, []);

  const actions = useMemo(
    () => ({ setGuestMode, refreshUserProfile, signOut }),
    [setGuestMode, refreshUserProfile, signOut],
  );

  return (
    <AuthContext.Provider value={actions}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const actions = useContext(AuthContext);
  const user = useSessionStore((state) => state.user);
  const userProfile = useSessionStore((state) => state.userProfile);
  const loading = useSessionStore((state) => state.loading);
  const error = useSessionStore((state) => state.error);
  const isGuestMode = useSessionStore((state) => state.isGuestMode);
  const emailVerified = useSessionStore((state) => state.emailVerified);
  const accountDeleted = useSessionStore((state) => state.accountDeleted);
  if (!actions) throw new Error('useAuth must be used within AuthProvider');
  return {
    user,
    userProfile,
    loading,
    error,
    isGuestMode,
    emailVerified,
    accountDeleted,
    ...actions,
  };
}
