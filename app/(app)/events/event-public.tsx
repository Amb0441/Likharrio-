import { Ionicons } from "@expo/vector-icons";
import { useGuardedRouter } from "../../../utils/navigationGuard";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  FlatList,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { db } from "../../../lib/firebase";
import COLORS from "../../../constants/Colors";
import { useAuth } from "../../../contexts/AuthContext";
import { isEventPast } from "../../../lib/helpers";

// ── Types ──
interface Event {
  id: string;
  title: string;
  description: string;
  location: string;
  eventDate: any;
  artistId: string;
  artistName: string;
  status: "upcoming" | "ongoing" | "completed" | "cancelled";
  createdAt: any;
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default function EnthusiastEventsAll() {
  const { user } = useAuth();
  const { guardedPush, guardedReplace } = useGuardedRouter();

  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  const isNavigating = useRef(false);

  // ── Safe navigation ──
  const safeNavigate = (id: string) => {
    if (isNavigating.current) return;
    isNavigating.current = true;
    guardedPush({ pathname: "/(app)/events/event-detail", params: { id } });
    setTimeout(() => { isNavigating.current = false; }, 1000);
  };

  // ── Hardware back ──
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      guardedReplace("/(app)/enthusiast/enthusiast-home");
      return true;
    });
    return () => sub.remove();
  }, []);

  // ── Listener ──
  useEffect(() => {
    if (!user) return;

    const eventsQuery = query(
      collection(db, "events"),
      where("status", "in", ["upcoming", "ongoing"]),
      orderBy("eventDate", "desc")
    );

    const unsubscribe = onSnapshot(eventsQuery, (snap) => {
      const fetched = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Event[];

      setEvents(fetched);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // ── Helpers ──
  const formatDate = (ts: any) => {
    if (!ts) return "TBD";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
  };

  const formatTime = (ts: any) => {
    if (!ts) return "";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    let h = d.getHours();
    const m = d.getMinutes();
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return `${h}:${m < 10 ? "0" + m : m} ${ampm}`;
  };

  // ── Render event card ──
  const renderEventCard = ({ item }: { item: Event }) => {
    const dateParts = formatDate(item.eventDate).split(" ");
    return (
      <TouchableOpacity
        style={styles.eventCard}
        onPress={() => safeNavigate(item.id)}
        activeOpacity={0.82}
      >
        <View style={styles.eventDateBox}>
          <Text style={styles.eventDateLabel}>{dateParts[0]}</Text>
          <Text style={styles.eventDateNum}>{dateParts[1]}</Text>
        </View>

        <View style={styles.eventInfo}>
          <Text style={styles.eventTitle} numberOfLines={1}>
            {item.title}
          </Text>
          {item.artistName && (
            <Text style={styles.eventArtist} numberOfLines={1}>
              {item.artistName}
            </Text>
          )}
          <Text style={styles.eventSub} numberOfLines={1}>
            {item.location}
          </Text>
          <Text style={styles.eventTime}>{formatTime(item.eventDate)}</Text>
        </View>

        <View style={styles.eventRight}>
          {isEventPast(item.eventDate) && (
            <View style={styles.pastBadge}>
              <Text style={styles.pastBadgeText}>Past Due</Text>
            </View>
          )}
          <Ionicons name="chevron-forward" size={16} color="#C8BAA8" />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => guardedReplace("/(app)/enthusiast/enthusiast-home")}
        >
          <Ionicons name="arrow-back" size={20} color="#2A1005" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>All Events</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary.deepRed} />
        </View>
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={renderEventCard}
          ListEmptyComponent={() => (
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={48} color="#C8BAA8" />
              <Text style={styles.emptyTitle}>No upcoming events</Text>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

// ── Styles ──
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background.primary,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.light,
    backgroundColor: COLORS.background.primary,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: COLORS.border.light,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: COLORS.text.primary,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  // List
  list: {
    padding: 20,
    gap: 12,
  },

  // Event card
  eventCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: COLORS.border.light,
    shadowColor: COLORS.text.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  eventDateBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "rgba(139,26,26,0.08)",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  eventDateLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: COLORS.primary.deepRed,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  eventDateNum: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.primary.deepRed,
    lineHeight: 20,
  },
  eventInfo: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.text.primary,
    marginBottom: 2,
  },
  eventArtist: {
    fontSize: 12,
    color: COLORS.primary.deepRed,
    fontWeight: "600",
    marginBottom: 1,
  },
  eventSub: {
    fontSize: 12,
    color: COLORS.text.secondary,
  },
  eventTime: {
    fontSize: 11,
    color: COLORS.text.muted,
    marginTop: 2,
  },
  eventRight: {
    alignItems: "flex-end",
    gap: 6,
  },
  pastBadge: {
    backgroundColor: "#EDE0D4",
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  pastBadgeText: {
    color: "#6B5946",
    fontSize: 10,
    fontWeight: "700",
  },

  // Empty state
  emptyState: {
    alignItems: "center",
    marginTop: 80,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 15,
    color: COLORS.text.secondary,
    fontWeight: "600",
  },
});
