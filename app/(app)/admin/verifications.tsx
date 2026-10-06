import { collection, onSnapshot } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import COLORS from "../../../constants/Colors";
import { approveVerification, rejectVerification } from "../../../lib/adminActions";
import { db } from "../../../lib/firebase";

type Verification = {
  id: string;
  uid: string;
  email?: string;
  govIdUrl?: string;
  selfieUrl?: string;
  sampleUrls?: string[];
  portfolioLink?: string | null;
  status?: string;
};

const FILTERS = ["pending", "approved", "rejected", "all"] as const;

export default function AdminVerifications() {
  const [items, setItems] = useState<Verification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("pending");
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "verificationRequests"),
      (snap) => {
        setItems(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Verification, "id">) }))
        );
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );
    return unsub;
  }, []);

  const visible = useMemo(
    () => items.filter((item) => filter === "all" || (item.status ?? "pending") === filter),
    [items, filter]
  );

  const approve = (item: Verification) => {
    Alert.alert("Approve artist", `Approve ${item.email || item.uid}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Approve",
        onPress: async () => {
          setBusyId(item.id);
          try {
            await approveVerification(item.id, item.uid || item.id);
          } catch (err) {
            Alert.alert("Could not approve", err instanceof Error ? err.message : "Try again.");
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  const reject = async (item: Verification) => {
    setBusyId(item.id);
    try {
      await rejectVerification(item.id, item.uid || item.id, note);
      setNoteFor(null);
      setNote("");
    } catch (err) {
      Alert.alert("Could not reject", err instanceof Error ? err.message : "Try again.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.title}>Verifications</Text>
      <Text style={styles.subtitle}>Review government ID, selfie, and sample artwork.</Text>

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
      {!loading && visible.length === 0 ? (
        <Text style={styles.empty}>No {filter === "all" ? "" : filter} requests.</Text>
      ) : null}

      {visible.map((item) => (
        <View key={item.id} style={styles.card}>
          <View style={styles.cardHead}>
            <View style={{ flex: 1 }}>
              <Text style={styles.email}>{item.email || item.uid}</Text>
              <Text style={styles.meta}>{item.status || "pending"}</Text>
            </View>
          </View>

          <View style={styles.images}>
            {item.govIdUrl ? <Shot uri={item.govIdUrl} label="ID" /> : null}
            {item.selfieUrl ? <Shot uri={item.selfieUrl} label="Selfie" /> : null}
            {(item.sampleUrls ?? []).map((uri) => (
              <Shot key={uri} uri={uri} label="Sample" />
            ))}
          </View>

          {item.portfolioLink ? (
            <Pressable onPress={() => Linking.openURL(item.portfolioLink!)}>
              <Text style={styles.link}>{item.portfolioLink}</Text>
            </Pressable>
          ) : null}

          {(item.status ?? "pending") === "pending" ? (
            <View style={styles.actions}>
              <Pressable
                style={styles.approve}
                disabled={busyId === item.id}
                onPress={() => approve(item)}
              >
                <Text style={styles.approveText}>Approve</Text>
              </Pressable>
              <Pressable
                style={styles.reject}
                disabled={busyId === item.id}
                onPress={() => {
                  setNoteFor(noteFor === item.id ? null : item.id);
                  setNote("");
                }}
              >
                <Text style={styles.rejectText}>Reject</Text>
              </Pressable>
            </View>
          ) : null}

          {noteFor === item.id ? (
            <View style={styles.noteBox}>
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder="Reason shown to the artist"
                placeholderTextColor={COLORS.text.placeholder}
                style={styles.input}
                multiline
              />
              <Pressable style={styles.reject} onPress={() => reject(item)}>
                <Text style={styles.rejectText}>Send rejection</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      ))}
    </ScrollView>
  );
}

function Shot({ uri, label }: { uri: string; label: string }) {
  return (
    <Pressable onPress={() => Linking.openURL(uri)} style={styles.shot}>
      <Image source={{ uri }} style={styles.shotImage} />
      <Text style={styles.shotLabel}>{label}</Text>
    </Pressable>
  );
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
    marginBottom: 4,
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
    marginTop: 12,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border.primary,
    padding: 14,
    gap: 12,
  },
  cardHead: {
    flexDirection: "row",
    alignItems: "center",
  },
  email: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.text.primary,
  },
  meta: {
    marginTop: 2,
    color: COLORS.text.muted,
    textTransform: "capitalize",
    fontSize: 13,
  },
  images: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  shot: {
    width: 96,
  },
  shotImage: {
    width: 96,
    height: 96,
    borderRadius: 8,
    backgroundColor: COLORS.background.secondary,
  },
  shotLabel: {
    marginTop: 4,
    fontSize: 11,
    color: COLORS.text.muted,
    fontWeight: "600",
  },
  link: {
    color: COLORS.primary.deepRed,
    fontSize: 13,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
  },
  approve: {
    backgroundColor: COLORS.primary.forestGreen,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  approveText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  reject: {
    backgroundColor: COLORS.status.error.bg,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  rejectText: {
    color: COLORS.status.error.text,
    fontWeight: "700",
  },
  noteBox: {
    gap: 8,
  },
  input: {
    minHeight: 72,
    borderWidth: 1,
    borderColor: COLORS.border.primary,
    borderRadius: 10,
    padding: 10,
    color: COLORS.text.primary,
    textAlignVertical: "top",
  },
});
