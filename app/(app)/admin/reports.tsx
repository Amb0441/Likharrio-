import { collection, onSnapshot } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import COLORS from "../../../constants/Colors";
import { resolveReport } from "../../../lib/adminActions";
import { db } from "../../../lib/firebase";

type Report = {
  id: string;
  targetType?: string;
  targetTitle?: string;
  targetId?: string;
  reason?: string;
  description?: string;
  reportedBy?: string;
  status?: string;
};

const FILTERS = ["pending", "reviewed", "dismissed", "all"] as const;

export default function AdminReports() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("pending");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "reports"),
      (snap) => {
        setReports(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Report, "id">) })));
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );
    return unsub;
  }, []);

  const visible = useMemo(
    () => reports.filter((report) => filter === "all" || (report.status ?? "pending") === filter),
    [reports, filter]
  );

  const update = async (id: string, status: "reviewed" | "dismissed") => {
    setBusyId(id);
    try {
      await resolveReport(id, status);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the report.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.title}>Reports</Text>
      <Text style={styles.subtitle}>Listings, artists, and artwork flagged by the community.</Text>

      <View style={styles.filters}>
        {FILTERS.map((name) => (
          <Pressable
            key={name}
            onPress={() => setFilter(name)}
            style={[styles.chip, filter === name && styles.chipOn]}
          >
            <Text style={[styles.chipText, filter === name && styles.chipTextOn]}>{name}</Text>
          </Pressable>
        ))}
      </View>

      {loading ? <ActivityIndicator color={COLORS.primary.deepRed} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!loading && visible.length === 0 ? <Text style={styles.empty}>Nothing in this queue.</Text> : null}

      {visible.map((report) => (
        <View key={report.id} style={styles.card}>
          <Text style={styles.reason}>{labelFor(report.reason)}</Text>
          <Text style={styles.target}>
            {(report.targetType || "item")} · {report.targetTitle || report.targetId || "Untitled"}
          </Text>
          {report.description ? <Text style={styles.body}>{report.description}</Text> : null}
          <Text style={styles.meta}>Status: {report.status || "pending"}</Text>
          {(report.status ?? "pending") === "pending" ? (
            <View style={styles.actions}>
              <Pressable
                style={styles.primary}
                disabled={busyId === report.id}
                onPress={() => update(report.id, "reviewed")}
              >
                <Text style={styles.primaryText}>Mark reviewed</Text>
              </Pressable>
              <Pressable
                style={styles.secondary}
                disabled={busyId === report.id}
                onPress={() => update(report.id, "dismissed")}
              >
                <Text style={styles.secondaryText}>Dismiss</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      ))}
    </ScrollView>
  );
}

function labelFor(reason?: string) {
  const labels: Record<string, string> = {
    inappropriate: "Inappropriate content",
    spam: "Spam or misleading",
    copyright: "Copyright violation",
    harassment: "Harassment or hate",
    fake: "Fake or scam",
    other: "Other",
  };
  return labels[reason || ""] || reason || "Report";
}

const styles = StyleSheet.create({
  page: {
    padding: 24,
    gap: 12,
    maxWidth: 880,
    width: "100%",
    alignSelf: "center",
    paddingBottom: 48,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: COLORS.text.primary,
  },
  subtitle: {
    color: COLORS.text.muted,
    fontSize: 14,
  },
  filters: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: COLORS.background.secondary,
  },
  chipOn: {
    backgroundColor: COLORS.primary.deepRed,
  },
  chipText: {
    color: COLORS.text.secondary,
    fontWeight: "700",
    fontSize: 13,
    textTransform: "capitalize",
  },
  chipTextOn: {
    color: "#FFFFFF",
  },
  error: {
    color: COLORS.status.error.text,
  },
  empty: {
    color: COLORS.text.muted,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border.primary,
    padding: 14,
    gap: 6,
  },
  reason: {
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.text.primary,
  },
  target: {
    color: COLORS.text.secondary,
    fontSize: 13,
    textTransform: "capitalize",
  },
  body: {
    color: COLORS.text.primary,
    fontSize: 14,
    lineHeight: 20,
  },
  meta: {
    color: COLORS.text.muted,
    fontSize: 12,
    textTransform: "capitalize",
  },
  actions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 6,
  },
  primary: {
    backgroundColor: COLORS.primary.deepRed,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  primaryText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 13,
  },
  secondary: {
    backgroundColor: COLORS.background.secondary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  secondaryText: {
    color: COLORS.text.secondary,
    fontWeight: "700",
    fontSize: 13,
  },
});
