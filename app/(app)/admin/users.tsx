import { collection, onSnapshot } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import COLORS from "../../../constants/Colors";
import {
  setUserPendingDelete,
  setUserRole,
  setUserSuspended,
} from "../../../lib/adminActions";
import { db } from "../../../lib/firebase";
import { useAuth } from "../../../contexts/AuthContext";

type Person = {
  id: string;
  email?: string;
  displayName?: string;
  role?: string;
  artistStatus?: string | null;
  verified?: boolean;
  suspended?: boolean;
  pendingDelete?: boolean;
  disabled?: boolean;
};

const ROLES = ["all", "artist", "enthusiast", "admin"] as const;

export default function AdminUsers() {
  const { user } = useAuth();
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<(typeof ROLES)[number]>("all");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "users"),
      (snap) => {
        setPeople(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Person, "id">) })));
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );
    return unsub;
  }, []);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return people.filter((person) => {
      const matchesRole = role === "all" || person.role === role;
      const haystack = `${person.email ?? ""} ${person.displayName ?? ""}`.toLowerCase();
      return matchesRole && (!q || haystack.includes(q));
    });
  }, [people, search, role]);

  const run = async (id: string, action: () => Promise<void>) => {
    setBusyId(id);
    try {
      await action();
    } catch (err) {
      Alert.alert("Update failed", err instanceof Error ? err.message : "Try again.");
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = (person: Person) => {
    Alert.alert(
      "Schedule deletion",
      `${person.email || person.displayName || person.id} will be signed out and their login removed the next time the app opens.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Schedule deletion",
          style: "destructive",
          onPress: () => run(person.id, () => setUserPendingDelete(person.id)),
        },
      ]
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.title}>Users</Text>
      <Text style={styles.subtitle}>Suspend an account, restore it, or change its role.</Text>

      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search name or email"
        placeholderTextColor={COLORS.text.placeholder}
        style={styles.search}
        autoCapitalize="none"
      />

      <View style={styles.filters}>
        {ROLES.map((name) => (
          <Pressable
            key={name}
            onPress={() => setRole(name)}
            style={[styles.chip, role === name && styles.chipOn]}
          >
            <Text style={[styles.chipText, role === name && styles.chipTextOn]}>{name}</Text>
          </Pressable>
        ))}
      </View>

      {loading ? <ActivityIndicator color={COLORS.primary.deepRed} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Text style={styles.count}>{visible.length} shown</Text>

      {visible.map((person) => {
        const self = person.id === user?.uid;
        const suspended = person.suspended === true;
        return (
          <View key={person.id} style={styles.card}>
            <Text style={styles.name}>{person.displayName || "Unnamed"}</Text>
            <Text style={styles.email}>{person.email || person.id}</Text>
            <Text style={styles.meta}>
              {(person.role || "no role")}
              {person.role === "artist" && person.artistStatus ? ` · ${person.artistStatus}` : ""}
              {person.verified ? " · verified" : ""}
              {suspended ? " · suspended" : ""}
              {person.pendingDelete || person.disabled ? " · pending deletion" : ""}
              {self ? " · you" : ""}
            </Text>

            <View style={styles.actions}>
              {suspended ? (
                <Action
                  label="Restore"
                  tone="good"
                  disabled={busyId === person.id}
                  onPress={() => run(person.id, () => setUserSuspended(person.id, false))}
                />
              ) : (
                <Action
                  label="Suspend"
                  tone="warn"
                  disabled={busyId === person.id || self}
                  onPress={() => run(person.id, () => setUserSuspended(person.id, true))}
                />
              )}
              {person.role !== "artist" ? (
                <Action
                  label="Make artist"
                  disabled={busyId === person.id}
                  onPress={() => run(person.id, () => setUserRole(person.id, "artist"))}
                />
              ) : null}
              {person.role !== "enthusiast" ? (
                <Action
                  label="Make enthusiast"
                  disabled={busyId === person.id || self}
                  onPress={() => run(person.id, () => setUserRole(person.id, "enthusiast"))}
                />
              ) : null}
              {person.role !== "admin" ? (
                <Action
                  label="Make admin"
                  disabled={busyId === person.id}
                  onPress={() => run(person.id, () => setUserRole(person.id, "admin"))}
                />
              ) : null}
              <Action
                label="Delete"
                tone="bad"
                disabled={busyId === person.id || self}
                onPress={() => confirmDelete(person)}
              />
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

function Action({
  label,
  onPress,
  disabled,
  tone = "neutral",
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: "neutral" | "good" | "warn" | "bad";
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.action,
        tone === "good" && styles.good,
        tone === "warn" && styles.warn,
        tone === "bad" && styles.bad,
        disabled && styles.disabled,
      ]}
    >
      <Text
        style={[
          styles.actionText,
          tone === "good" && styles.goodText,
          tone === "warn" && styles.warnText,
          tone === "bad" && styles.badText,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: {
    padding: 24,
    gap: 10,
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
  search: {
    marginTop: 6,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: COLORS.border.primary,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: COLORS.text.primary,
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
  count: {
    color: COLORS.text.muted,
    fontSize: 12,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border.primary,
    padding: 14,
    gap: 4,
  },
  name: {
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.text.primary,
  },
  email: {
    color: COLORS.text.secondary,
    fontSize: 13,
  },
  meta: {
    color: COLORS.text.muted,
    fontSize: 12,
    textTransform: "capitalize",
    marginBottom: 6,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  action: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: COLORS.background.secondary,
  },
  actionText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.text.secondary,
  },
  good: { backgroundColor: COLORS.status.success.bg },
  goodText: { color: COLORS.status.success.text },
  warn: { backgroundColor: COLORS.status.warning.bg },
  warnText: { color: COLORS.status.warning.text },
  bad: { backgroundColor: COLORS.status.error.bg },
  badText: { color: COLORS.status.error.text },
  disabled: { opacity: 0.45 },
});
