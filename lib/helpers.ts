import { Alert } from "react-native";

/**
 * Format a Firestore timestamp into a short date string.
 * e.g. "Jan 15", "TBD"
 */
export const formatEventDate = (timestamp: any): string => {
  if (!timestamp) return "TBD";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${months[date.getMonth()]} ${date.getDate()}`;
};

/**
 * Return the JS Date for a Firestore timestamp (or JS Date / string).
 */
export const toDate = (timestamp: any): Date | null => {
  if (!timestamp) return null;
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return isNaN(date.getTime()) ? null : date;
};

/**
 * True if the event date/time has already passed.
 */
export const isEventPast = (timestamp: any): boolean => {
  const date = toDate(timestamp);
  if (!date) return false;
  return date.getTime() < Date.now();
};

/**
 * Return a time-of-day greeting with emoji.
 */
export const getGreeting = (): string => {
  const h = new Date().getHours();
  if (h < 12) return "Good morning ☀️";
  if (h < 17) return "Good afternoon 🌤️";
  if (h < 21) return "Good evening 🌇";
  return "Good night 🌙";
};

/**
 * Show a standard "Sign In Required" alert that navigates to login or signup.
 */
export const showGuestAlert = (
  guardedPush: (route: any) => void,
  feature?: string,
) => {
  Alert.alert(
    "Sign In Required",
    `Please sign in or sign up${feature ? ` to ${feature}` : ""}`,
    [
      { text: "Sign In", onPress: () => guardedPush("/(auth)/login") },
      {
        text: "Sign Up",
        onPress: () => guardedPush("/(auth)/role-selection"),
      },
      { text: "Cancel", style: "cancel" as const },
    ],
  );
};

/**
 * Generate a deterministic avatar background color from a name string.
 */
export const getAvatarColor = (name: string): string => {
  const colors = ["#C9413E", "#2D7D6F", "#C48A1A", "#6B5B95", "#4A7FA5"];
  return colors[(name?.length || 0) % colors.length];
};

/**
 * Format a Firestore timestamp into a relative time string.
 * e.g. "Just now", "5m ago", "3h ago", "2d ago", or a date string.
 */
export const formatCommentTime = (timestamp: any): string => {
  if (!timestamp) return "Just now";
  const date = timestamp.toDate
    ? timestamp.toDate()
    : new Date(timestamp);
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};
