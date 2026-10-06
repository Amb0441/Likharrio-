import { Feather } from "@expo/vector-icons";
import { usePathname, useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import COLORS from "../../constants/Colors";
import { useAuth } from "../../contexts/AuthContext";

const LINKS = [
  { href: "/(app)/admin", label: "Overview", icon: "grid" as const, match: "/admin" },
  { href: "/(app)/admin/verifications", label: "Verifications", icon: "shield" as const, match: "/verifications" },
  { href: "/(app)/admin/users", label: "Users", icon: "users" as const, match: "/users" },
  { href: "/(app)/admin/reports", label: "Reports", icon: "flag" as const, match: "/reports" },
];

export default function AdminNav({ wide }: { wide: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut } = useAuth();

  const isActive = (match: string) => {
    if (match === "/admin") {
      return pathname === "/admin" || pathname.endsWith("/admin");
    }
    return pathname.includes(match);
  };

  return (
    <View style={[styles.bar, wide ? styles.barWide : styles.barNarrow]}>
      <View style={styles.brandRow}>
        <Text style={styles.brand}>Likharrio</Text>
        <Text style={styles.brandSub}>Admin</Text>
      </View>
      <ScrollView
        horizontal={!wide}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={wide ? styles.linksWide : styles.linksNarrow}
      >
        {LINKS.map((link) => {
          const active = isActive(link.match);
          return (
            <Pressable
              key={link.href}
              onPress={() => router.replace(link.href as never)}
              style={[styles.link, active && styles.linkActive]}
            >
              <Feather
                name={link.icon}
                size={16}
                color={active ? COLORS.background.dark : "#E7D3C4"}
              />
              <Text style={[styles.linkText, active && styles.linkTextActive]}>{link.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <Pressable
        onPress={async () => {
          await signOut();
          router.replace("/(auth)/welcome");
        }}
        style={styles.signOut}
      >
        <Feather name="log-out" size={16} color="#E7D3C4" />
        {wide ? <Text style={styles.signOutText}>Sign out</Text> : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: COLORS.background.dark,
  },
  barWide: {
    width: 220,
    paddingTop: 28,
    paddingHorizontal: 14,
    paddingBottom: 20,
    justifyContent: "flex-start",
  },
  barNarrow: {
    paddingTop: 12,
    paddingBottom: 10,
    paddingHorizontal: 12,
  },
  brandRow: {
    paddingHorizontal: 8,
    marginBottom: 16,
  },
  brand: {
    color: COLORS.text.light,
    fontSize: 18,
    fontWeight: "800",
  },
  brandSub: {
    color: COLORS.secondary.goldenYellow,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginTop: 2,
  },
  linksWide: {
    gap: 6,
  },
  linksNarrow: {
    gap: 8,
    paddingRight: 8,
  },
  link: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  linkActive: {
    backgroundColor: COLORS.secondary.goldenYellow,
  },
  linkText: {
    color: "#E7D3C4",
    fontSize: 14,
    fontWeight: "600",
  },
  linkTextActive: {
    color: COLORS.background.dark,
  },
  signOut: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 18,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  signOutText: {
    color: "#E7D3C4",
    fontSize: 14,
    fontWeight: "600",
  },
});
