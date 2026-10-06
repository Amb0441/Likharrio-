import { Feather } from "@expo/vector-icons";
import { usePathname, useRouter } from "expo-router";
import { useRef } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAuth } from "../../contexts/AuthContext";

type TabName = "home" | "list" | "marketplace" | "chat" | "profile";

interface Tab {
  name: TabName;
  label: string;
  icon: keyof typeof Feather.glyphMap;
  route: string;
}

const ENTHUSIAST_TABS: Tab[] = [
  { name: "home",        label: "Home",        icon: "home",           route: "/enthusiast/enthusiast-home" },
  { name: "list",        label: "Discover",    icon: "compass",        route: "/enthusiast/enthusiast-list" },
  { name: "marketplace", label: "Marketplace", icon: "shopping-bag",   route: "/marketplace/enthusiast-marketplace" },
  { name: "chat",        label: "Chat",        icon: "message-circle", route: "/chat" },
  { name: "profile",     label: "Profile",     icon: "user",           route: "/enthusiast/enthusiast-profile" },
];

const HIDDEN_ROUTES = [
  "artist-profile-view", "event-detail", "product-detail", "chat-detail",
  "/event-public", "/artist-profile-view", "/allartist", "/portfolio-detail",
  "/id", "/new-chat", "/showcase-detail", "/create-portfolio", "/create-event",
  "/edit-portfolio", "/listing-details", "/welcome", "/login", "/role-selection",
  "/signup", "/notifications", "/RecommendationInfoModal", "/recommendation",
  "/group-enthusiast",
];

export default function EnthusiastBottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { isGuestMode } = useAuth();
  const isNavigating = useRef(false);

  if (HIDDEN_ROUTES.some(r => pathname.includes(r))) return null;

  const isTabActive = (tab: Tab): boolean => {
    if (tab.name === "home")        return pathname.includes("enthusiast-home");
    if (tab.name === "list")        return pathname.includes("enthusiast-list");
    if (tab.name === "marketplace") return pathname.includes("enthusiast-marketplace");
    if (tab.name === "chat")        return pathname.includes("chat") && !pathname.includes("chat-detail");
    if (tab.name === "profile")     return pathname.includes("enthusiast-profile");
    return false;
  };

  const handleTabPress = (tab: Tab) => {
    if (isNavigating.current || isTabActive(tab)) return;

    if (isGuestMode && (tab.name === 'chat' || tab.name === 'profile')) {
      Alert.alert('Sign In Required', `Please sign in or sign up to access ${tab.label}`, [
        { text: 'Sign In',  onPress: () => router.push('/(auth)/login') },
        { text: 'Sign Up',  onPress: () => router.push('/(auth)/role-selection') },
        { text: 'Cancel',   style: 'cancel' },
      ]);
      return;
    }

    isNavigating.current = true;
    router.replace(tab.route as any);
    setTimeout(() => { isNavigating.current = false; }, 500);
  };

  return (
    <View style={styles.container}>
      {ENTHUSIAST_TABS.map((tab) => {
        const active = isTabActive(tab);
        return (
          <TouchableOpacity key={tab.name} style={styles.tab} onPress={() => handleTabPress(tab)} activeOpacity={0.7}>
            <View style={[styles.iconWrap, active && styles.iconWrapActive]}>
              <Feather name={tab.icon} size={20} color={active ? '#8B1A1A' : '#9B8265'} />
            </View>
            <Text style={[styles.label, active && styles.labelActive]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#EDE0D4',
    paddingTop: 8,
    paddingBottom: 20,
    shadowColor: '#2A1005',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    gap: 3,
  },
  iconWrap: {
    width: 36,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  iconWrapActive: {
    backgroundColor: '#FDF5F2',
  },
  label: {
    fontSize: 10,
    fontWeight: '500',
    color: '#9B8265',
  },
  labelActive: {
    color: '#8B1A1A',
    fontWeight: '700',
  },
});
