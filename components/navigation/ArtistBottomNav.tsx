import { Feather } from "@expo/vector-icons";
import { usePathname } from "expo-router";
import { useGuardedRouter } from "../../utils/navigationGuard";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

type TabName = "home" | "marketplace" | "create" | "chat" | "profile";

interface Tab {
  name: TabName;
  label: string;
  icon?: keyof typeof Feather.glyphMap;
  route: string;
  isCreate?: boolean;
}

const ARTIST_TABS: Tab[] = [
  { name: "home",        label: "Home",        icon: "home",          route: "/artist/artist-home" },
  { name: "marketplace", label: "Marketplace", icon: "shopping-bag",  route: "/marketplace/artist-marketplace" },
  { name: "create",      label: "Create",                             route: "/create-selection", isCreate: true },
  { name: "chat",        label: "Chat",        icon: "message-circle", route: "/chat" },
  { name: "profile",     label: "Profile",     icon: "user",          route: "/artist/artist-profile" },
];

const HIDDEN_ROUTES = [
  "/listing-items", "/create-portfolio", "/advanced-anaytics", "/advanced-analytics",
  "/chat/detail", "/new-chat", "/showcase-detail", "/showcase-all",
  "/event-detail", "/event-all", "/create-event", "/edit-portfolio",
  "/listing-details", "/group-artist",
];

export default function ArtistBottomNav() {
  const { guardedReplace } = useGuardedRouter();
  const pathname = usePathname();

  if (HIDDEN_ROUTES.some(r => pathname.includes(r))) return null;

  const isTabActive = (tab: Tab): boolean => {
    if (tab.name === "profile")     return pathname.includes("artist-profile") || pathname.includes("profile");
    if (tab.name === "home")        return pathname.includes("artist-home") || pathname === "/home";
    if (tab.name === "marketplace") return pathname.includes("marketplace");
    if (tab.name === "chat")        return pathname.includes("chat") && !pathname.includes("/chat/detail") && !pathname.includes("new-chat");
    if (tab.name === "create")      return pathname.includes("/create-selection");
    return false;
  };

  const handleTabPress = (tab: Tab) => {
    if (isTabActive(tab)) return;
    guardedReplace(tab.route as any);
  };

  return (
    <View style={styles.container}>
      {ARTIST_TABS.map((tab) => {
        const active = isTabActive(tab);

        if (tab.isCreate) {
          return (
            <TouchableOpacity key={tab.name} style={styles.createTab} onPress={() => handleTabPress(tab)} activeOpacity={0.8}>
              <View style={styles.createBtn}>
                <Feather name="plus" size={24} color="#fff" />
              </View>
            </TouchableOpacity>
          );
        }

        return (
          <TouchableOpacity key={tab.name} style={styles.tab} onPress={() => handleTabPress(tab)} activeOpacity={0.7}>
            <View style={[styles.iconWrap, active && styles.iconWrapActive]}>
              <Feather name={tab.icon!} size={20} color={active ? '#8B1A1A' : '#9B8265'} />
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
    paddingBottom: 8,
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
  createTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  createBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#8B1A1A',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#8B1A1A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
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
