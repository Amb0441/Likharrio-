import { Feather } from "@expo/vector-icons";
import { usePathname, useRouter } from "expo-router";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import LikharrioLogo from "../ui/LikharrioLogo";
import { useAuth } from "../../contexts/AuthContext";
import { useGuardedRouter } from "../../utils/navigationGuard";

type Role = "artist" | "enthusiast" | "admin";

type Item = {
  label: string;
  route: string;
  match: (pathname: string) => boolean;
  needsAccount?: boolean;
};

const ARTIST_ITEMS: Item[] = [
  { label: "Home", route: "/artist/artist-home", match: (p) => p.includes("artist-home") || p === "/home" },
  { label: "Marketplace", route: "/marketplace/artist-marketplace", match: (p) => p.includes("marketplace") },
  { label: "Create", route: "/create-selection", match: (p) => p.includes("create-selection") },
  { label: "Chat", route: "/chat", match: (p) => p.includes("/chat") },
  { label: "Profile", route: "/artist/artist-profile", match: (p) => p.includes("artist-profile") },
];

const ADMIN_ITEMS: Item[] = [
  { label: "Overview", route: "/admin", match: (p) => p === "/admin" || p.endsWith("/admin") },
  { label: "Verifications", route: "/admin/verifications", match: (p) => p.includes("verifications") },
  { label: "Users", route: "/admin/users", match: (p) => p.includes("/users") },
  { label: "Reports", route: "/admin/reports", match: (p) => p.includes("/reports") },
];

const ENTHUSIAST_ITEMS: Item[] = [
  { label: "Home", route: "/enthusiast/enthusiast-home", match: (p) => p.includes("enthusiast-home") },
  { label: "Discover", route: "/enthusiast/enthusiast-list", match: (p) => p.includes("enthusiast-list") },
  { label: "Marketplace", route: "/marketplace/enthusiast-marketplace", match: (p) => p.includes("enthusiast-marketplace") },
  { label: "Chat", route: "/chat", match: (p) => p.includes("/chat"), needsAccount: true },
  { label: "Profile", route: "/enthusiast/enthusiast-profile", match: (p) => p.includes("enthusiast-profile"), needsAccount: true },
];

export default function WebTopNav({ role }: { role: Role }) {
  const pathname = usePathname();
  const router = useRouter();
  const { guardedReplace } = useGuardedRouter();
  const { isGuestMode, signOut, userProfile } = useAuth();
  const items = role === "artist" ? ARTIST_ITEMS : role === "admin" ? ADMIN_ITEMS : ENTHUSIAST_ITEMS;

  const open = (item: Item) => {
    if (item.match(pathname)) return;
    if (isGuestMode && item.needsAccount) {
      Alert.alert("Sign In Required", `Please sign in or sign up to access ${item.label}`, [
        { text: "Sign In", onPress: () => router.push("/(auth)/login") },
        { text: "Sign Up", onPress: () => router.push("/(auth)/role-selection") },
        { text: "Cancel", style: "cancel" },
      ]);
      return;
    }
    if (role === "artist") guardedReplace(item.route as never);
    else router.replace(item.route as never);
  };

  return (
    <View style={styles.bar}>
      <Pressable onPress={() => open(items[0])} style={styles.brand}>
        <LikharrioLogo size={28} variant="light" showWordmark={false} showTagline={false} />
        <Text style={styles.brandName}>Likharrio</Text>
      </Pressable>

      <View style={styles.links}>
        {items.map((item) => {
          const active = item.match(pathname);
          return (
            <Pressable key={item.label} onPress={() => open(item)} style={styles.link}>
              <Text style={[styles.linkText, active && styles.linkTextActive]}>{item.label}</Text>
              {active ? <View style={styles.underline} /> : <View style={styles.underlineSpacer} />}
            </Pressable>
          );
        })}
      </View>

      <View style={styles.right}>
        <Pressable
          style={styles.iconBtn}
          onPress={() => {
            if (isGuestMode) {
              Alert.alert("Sign In Required", "Please sign in or sign up to view notifications", [
                { text: "Sign In", onPress: () => router.push("/(auth)/login") },
                { text: "Sign Up", onPress: () => router.push("/(auth)/role-selection") },
                { text: "Cancel", style: "cancel" },
              ]);
              return;
            }
            router.push("/(app)/notifications");
          }}
        >
          <Feather name="bell" size={16} color="#2A1005" />
        </Pressable>
        <Text style={styles.who} numberOfLines={1}>
          {isGuestMode ? "Guest" : userProfile?.displayName || role}
        </Text>
        <Pressable
          style={styles.signOut}
          onPress={async () => {
            if (isGuestMode) {
              router.replace("/(auth)/welcome");
              return;
            }
            await signOut();
            router.replace("/(auth)/welcome");
          }}
        >
          <Feather name={isGuestMode ? "log-in" : "log-out"} size={15} color="#8B1A1A" />
          <Text style={styles.signOutText}>{isGuestMode ? "Sign in" : "Sign out"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: 68,
    backgroundColor: "#FFFcf8",
    borderBottomWidth: 1,
    borderBottomColor: "#EDE0D4",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 28,
    gap: 28,
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  brandName: {
    fontSize: 18,
    fontWeight: "800",
    color: "#2A1005",
  },
  links: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  link: {
    paddingHorizontal: 12,
    paddingTop: 8,
    alignItems: "center",
  },
  linkText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#6B5946",
  },
  linkTextActive: {
    color: "#8B1A1A",
  },
  underline: {
    marginTop: 6,
    height: 2,
    width: "100%",
    backgroundColor: "#8B1A1A",
    borderRadius: 2,
  },
  underlineSpacer: {
    marginTop: 6,
    height: 2,
  },
  right: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#EDE0D4",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  who: {
    maxWidth: 160,
    color: "#6B5946",
    fontSize: 14,
    fontWeight: "600",
  },
  signOut: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#EDE0D4",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#FFFFFF",
  },
  signOutText: {
    color: "#8B1A1A",
    fontWeight: "700",
    fontSize: 13,
  },
});
