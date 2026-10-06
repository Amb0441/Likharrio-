import type { User } from "firebase/auth";
import { create } from "zustand";

export type SessionProfile = {
  uid: string;
  email: string | null;
  role: string | null;
  verified: boolean | null;
  artistStatus: "unsubmitted" | "pending" | "approved" | "rejected" | null;
  displayName: string | null;
  photoURL: string | null;
};

type SessionState = {
  user: User | null;
  userProfile: SessionProfile | null;
  loading: boolean;
  error: string | null;
  isGuestMode: boolean;
  emailVerified: boolean;
  accountDeleted: boolean;
  setGuestMode: (isGuest: boolean) => void;
  patch: (partial: Partial<Omit<SessionState, "setGuestMode" | "patch" | "reset">>) => void;
  reset: () => void;
};

const initialSession = {
  user: null,
  userProfile: null,
  loading: true,
  error: null,
  isGuestMode: false,
  emailVerified: false,
  accountDeleted: false,
};

export const useSessionStore = create<SessionState>((set) => ({
  ...initialSession,
  setGuestMode: (isGuest) =>
    set(isGuest ? { isGuestMode: true, loading: false } : { isGuestMode: false }),
  patch: (partial) => set(partial),
  reset: () => set({ ...initialSession, loading: false }),
}));
