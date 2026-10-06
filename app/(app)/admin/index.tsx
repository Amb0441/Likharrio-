import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { collection, getCountFromServer, query, where } from "firebase/firestore";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import COLORS from "../../../constants/Colors";
import { db } from "../../../lib/firebase";

type Stats = {
  users: number;
  listings: number;
  events: number;
  pendingVerifications: number;
  pendingReports: number;
};

const EMPTY: Stats = {
  users: 0,
  listings: 0,
  events: 0,
  pendingVerifications: 0,
  pendingReports: 0,
};

export default function AdminOverview() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [users, listings, events, verifications, reports] = await Promise.all([
        getCountFromServer(collection(db, "users")),
        getCountFromServer(collection(db, "listings")),
        getCountFromServer(collection(db, "events")),
        getCountFromServer(
          query(collection(db, "verificationRequests"), where("status", "==", "pending"))
        ),
        getCountFromServer(query(collection(db, "reports"), where("status", "==", "pending"))),
      ]);
      setStats({
        users: users.data().count,
        listings: listings.data().count,
        events: events.data().count,
        pendingVerifications: verifications.data().count,
        pendingReports: reports.data().count,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load admin stats.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Overview</Text>
          <Text style={styles.subtitle}>Community health and queues that need a decision.</Text>
        </View>
        <Pressable onPress={load} style={styles.refresh}>
          <Feather name="refresh-cw" size={16} color={COLORS.primary.deepRed} />
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator color={COLORS.primary.deepRed} style={styles.spinner} />
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.grid}>
        <StatCard label="People" value={stats.users} icon="users" />
        <StatCard label="Listings" value={stats.listings} icon="shopping-bag" />
        <StatCard label="Events" value={stats.events} icon="calendar" />
      </View>

      <Pressable style={styles.queue} onPress={() => router.push("/(app)/admin/verifications" as never)}>
        <View>
          <Text style={styles.queueLabel}>Artist verifications</Text>
          <Text style={styles.queueValue}>{stats.pendingVerifications} waiting</Text>
        </View>
        <Feather name="chevron-right" size={20} color={COLORS.text.muted} />
      </Pressable>

      <Pressable style={styles.queue} onPress={() => router.push("/(app)/admin/reports" as never)}>
        <View>
          <Text style={styles.queueLabel}>Reports</Text>
          <Text style={styles.queueValue}>{stats.pendingReports} open</Text>
        </View>
        <Feather name="chevron-right" size={20} color={COLORS.text.muted} />
      </Pressable>
    </ScrollView>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: keyof typeof Feather.glyphMap;
}) {
  return (
    <View style={styles.card}>
      <Feather name={icon} size={18} color={COLORS.primary.deepRed} />
      <Text style={styles.cardValue}>{value}</Text>
      <Text style={styles.cardLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    padding: 24,
    gap: 14,
    maxWidth: 880,
    width: "100%",
    alignSelf: "center",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: COLORS.text.primary,
  },
  subtitle: {
    marginTop: 4,
    color: COLORS.text.muted,
    fontSize: 14,
    maxWidth: 460,
  },
  refresh: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.background.secondary,
  },
  spinner: {
    marginVertical: 8,
  },
  error: {
    color: COLORS.status.error.text,
    backgroundColor: COLORS.status.error.bg,
    padding: 12,
    borderRadius: 10,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  card: {
    flexGrow: 1,
    minWidth: 140,
    backgroundColor: COLORS.background.secondary,
    borderRadius: 14,
    padding: 16,
    gap: 6,
  },
  cardValue: {
    fontSize: 28,
    fontWeight: "800",
    color: COLORS.text.primary,
  },
  cardLabel: {
    color: COLORS.text.muted,
    fontSize: 13,
    fontWeight: "600",
  },
  queue: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border.primary,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  queueLabel: {
    color: COLORS.text.secondary,
    fontSize: 13,
    fontWeight: "600",
  },
  queueValue: {
    marginTop: 4,
    color: COLORS.text.primary,
    fontSize: 18,
    fontWeight: "800",
  },
});
