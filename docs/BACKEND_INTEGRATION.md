# Backend Integration Guide for Ant

## Overview

The frontend is set up with placeholders for backend Firestore integration. This document explains what needs to be implemented.

---

## 1. Firestore Setup (Already Done)

File: `FirebaseConfig.ts`

The Firebase and Firestore initialization is already complete. Just make sure you have:

```typescript
export const app = initializeApp(firebaseConfig);
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage),
});
export const db = getFirestore(app); // Add this if not present
```

---

## 2. User Profile Structure

Collection: `users`
Document ID: `{userId}` (from Firebase Auth)

### Schema:

```typescript
{
  email: string;              // From Firebase Auth
  role: 'artist' | 'enthusiast' | null;  // null until role is selected
  verified: boolean;          // Only for artists (default: false)
  createdAt: string;          // ISO timestamp
  displayName?: string;       // Optional: for profile customization
  bio?: string;               // Optional
  profilePicture?: string;    // Optional: URL to image
}
```

---

## 3. Implementation Tasks

### Task 1: Create User Profile on Signup ⚠️ HIGH PRIORITY

**File:** `app/(auth)/signup.tsx`

**Location:** Line ~30 (inside `handleSignup` function, after successful signup)

**What to add:**

```typescript
// After this line:
await createUserWithEmailAndPassword(auth, email.trim(), password);

// Add this:
await setDoc(doc(db, "users", userCredential.user.uid), {
  email: userCredential.user.email,
  role: null, // Will be set in role-selection screen
  verified: false,
  createdAt: new Date().toISOString(),
});
```

**Why:** Creates the Firestore user profile when they first sign up.

---

### Task 2: Save Role Selection ⚠️ HIGH PRIORITY

**File:** `app/(auth)/role-selection.tsx`

**Location:** Lines 25-35 (marked with TODO comment)

**What to add:**

```typescript
await setDoc(
  doc(db, "users", user!.uid),
  {
    email: user!.email,
    role: selectedRole, // 'artist' or 'enthusiast'
    verified: false,
    createdAt: new Date().toISOString(),
  },
  { merge: true }
); // merge: true keeps existing fields
```

**Why:** Saves the user's selected role to their profile.

---

### Task 3: Check Role on App Start ⚠️ MEDIUM PRIORITY

**File:** `app/index.tsx`

**Location:** Lines 22-32 (marked with TODO comment)

**What to add:**

```typescript
// Import at top:
import { doc, getDoc } from "firebase/firestore";
import { db } from "../FirebaseConfig";

// Inside the component (after user check):
const userDoc = await getDoc(doc(db, "users", user.uid));
const hasRole = userDoc.exists() && userDoc.data()?.role !== null;

if (!hasRole) {
  return <Redirect href="/(auth)/role-selection" />;
}
```

**Why:** Redirects to role selection if user hasn't chosen a role yet.

**Note:** This requires converting the component to use async/await. Alternative approach:

```typescript
// Use a useEffect hook instead:
const [userProfile, setUserProfile] = useState(null);
const [profileLoading, setProfileLoading] = useState(true);

useEffect(() => {
  if (!user) return;

  const fetchProfile = async () => {
    const userDoc = await getDoc(doc(db, "users", user.uid));
    setUserProfile(userDoc.data());
    setProfileLoading(false);
  };

  fetchProfile();
}, [user]);

// Then in render:
if (profileLoading) return <ActivityIndicator />;
if (!userProfile?.role) return <Redirect href="/(auth)/role-selection" />;
return <Redirect href="/(app)/home" />;
```

---

## 4. Extended User Profile in AuthContext (Optional - Future Enhancement)

**File:** `contexts/AuthContext.tsx`

To make user profile data available throughout the app, extend AuthContext:

```typescript
// Add to context type:
type AuthContextValue = {
  user: User | null;
  profile: UserProfile | null; // NEW
  loading: boolean;
  error: string | null;
};

// Inside AuthProvider:
const [profile, setProfile] = useState<UserProfile | null>(null);

useEffect(() => {
  const authUnsubscribe = onAuthStateChanged(auth, (user) => {
    setUser(user);

    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    // Subscribe to user profile in Firestore
    const profileUnsubscribe = onSnapshot(doc(db, "users", user.uid), (doc) => {
      if (doc.exists()) {
        setProfile(doc.data() as UserProfile);
      }
      setLoading(false);
    });

    return profileUnsubscribe;
  });

  return authUnsubscribe;
}, []);
```

**Why:** Makes profile data (role, verified status) easily accessible via `useAuth()` hook.

---

## 5. Artist Verification (Future Feature)

When ready to implement artist verification:

1. Create `app/(app)/artist-verification.tsx` screen
2. Add fields for:
   - Portfolio links
   - Sample artwork uploads
   - Artist statement
3. Save verification request to Firestore:
   ```typescript
   {
     userId: user.uid,
     status: 'pending' | 'approved' | 'rejected',
     submittedAt: timestamp,
     portfolioLinks: [],
     // ... other fields
   }
   ```
4. Add admin panel to approve/reject requests
5. Update `users/{userId}/verified` field when approved

---

## Testing Checklist

- [ ] Sign up creates Firestore user profile
- [ ] Role selection saves role to Firestore
- [ ] App redirects to role-selection if role is missing
- [ ] App redirects to home if role exists
- [ ] Logout clears both Auth and Firestore state
- [ ] Role persists after app reload
