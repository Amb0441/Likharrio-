import ReactNativeAsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  browserLocalPersistence,
  getAuth,
  inMemoryPersistence,
  initializeAuth,
  type Auth,
  type Persistence,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { Platform } from "react-native";

type FirebaseExtra = {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
  measurementId?: string;
};

const embedded = (Constants.expoConfig?.extra?.firebase ?? {}) as FirebaseExtra;

function requiredEnv(name: string, embeddedValue?: string): string {
  const value = process.env[name] || embeddedValue;
  if (!value) {
    throw new Error(`Missing ${name}. Copy .env.example to .env and fill in the Firebase web config.`);
  }
  return value;
}

const firebaseConfig = {
  apiKey: requiredEnv("EXPO_PUBLIC_FIREBASE_API_KEY", embedded.apiKey),
  authDomain: requiredEnv("EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN", embedded.authDomain),
  projectId: requiredEnv("EXPO_PUBLIC_FIREBASE_PROJECT_ID", embedded.projectId),
  storageBucket: requiredEnv("EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET", embedded.storageBucket),
  messagingSenderId: requiredEnv("EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID", embedded.messagingSenderId),
  appId: requiredEnv("EXPO_PUBLIC_FIREBASE_APP_ID", embedded.appId),
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID || embedded.measurementId,
};

export const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

function createAuth(firebaseApp: FirebaseApp): Auth {
  if (Platform.OS === "web") {
    // inMemoryPersistence keeps static rendering (no window) from touching IndexedDB.
    const persistence = typeof window === "undefined" ? inMemoryPersistence : browserLocalPersistence;
    try {
      return initializeAuth(firebaseApp, { persistence });
    } catch {
      return getAuth(firebaseApp);
    }
  }

  const { getReactNativePersistence } = require("firebase/auth") as {
    getReactNativePersistence: (storage: typeof ReactNativeAsyncStorage) => Persistence;
  };

  return initializeAuth(firebaseApp, {
    persistence: getReactNativePersistence(ReactNativeAsyncStorage),
  });
}

export const auth = createAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
