import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useGuardedRouter } from "../../../utils/navigationGuard";
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { useEffect, useState } from "react";
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
import { getCached, setCache, cacheKey } from "../../../lib/dataCache";
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

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export default function EventsAll() {
  const { user } = useAuth();
  const { guardedPush, guardedReplace } = useGuardedRouter();
  const params = useLocalSearchParams<{ tab?: string }>();

  const [activeTab, setActiveTab] = useState<"mine" | "all">(
    params.tab === "all" ? "all" : "mine",
  );
  const [myEvents, setMyEvents] = useState<Event[]>([]);
  const [allEvents, setAllEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Hardware back ──
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      guardedReplace("/(app)/artist/artist-home");
      return true;
    });
    return () => sub.remove();
  }, []);

  // ── Listeners ──
  // Both queries capped at 50 — prevents the "All Artists" query from fetching
  // every event ever created as the collection grows over time.
  useEffect(() => {
    if (!user) return;

    const myKey = cacheKey('events_mine', user.uid);
    const allKey = cacheKey('events_all');
    const cachedMine = getCached<Event[]>(myKey);
    const cachedAll = getCached<Event[]>(allKey);
    if (cachedMine && cachedAll) {
      setMyEvents(cachedMine);
      setAllEvents(cachedAll);
      setLoading(false);
    }

    const sortByDate = (a: Event, b: Event) => {
      const da = a.eventDate?.toDate?.() ?? new Date(a.eventDate);
      const db2 = b.eventDate?.toDate?.() ?? new Date(b.eventDate);
      return db2.getTime() - da.getTime();
    };

    const unsubMine = onSnapshot(
      query(
        collection(db, "events"),
        where("artistId", "==", user.uid),
        orderBy("eventDate", "desc"),
        limit(50),
      ),
      (snap) => {
        const events = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Event[];
        setMyEvents([...events].sort(sortByDate));
        setCache(myKey, [...events].sort(sortByDate));
        setLoading(false);
      },
    );

    const unsubAll = onSnapshot(
      query(
        collection(db, "events"),
        orderBy("eventDate", "desc"),
        limit(50),
      ),
      (snap) => {
        const events = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Event[];
        setAllEvents([...events].sort(sortByDate));
        setCache(allKey, [...events].sort(sortByDate));
      },
    );

    return () => {
      unsubMine();
      unsubAll();
    };
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

  const displayedEvents = activeTab === "mine" ? myEvents : allEvents;

  // ── Render event card ──
  const renderEventCard = ({ item }: { item: Event }) => {
    const dateParts = formatDate(item.eventDate).split(" ");
    return (
      <TouchableOpacity
        style={styles.eventCard}
        onPress={() =>
          guardedPush({
            pathname: "/(app)/events/event-detail",
            params: { id: item.id },
          })
        }
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
          <Text style={styles.eventSub} numberOfLines={1}>
            {activeTab === "all" && item.artistName
              ? `${item.artistName} · ${item.location}`
              : item.location}
          </Text>
          <Text style={styles.eventTime}>{formatTime(item.eventDate)}</Text>
        </View>

        <View style={styles.eventRight}>
          {isEventPast(item.eventDate) && (
            <View style={styles.pastBadge}>
              <Text style={styles.pastBadgeText}>Past Due</Text>
            </View>
          )}
          {activeTab === "all" && item.artistId === user?.uid && (
            <View style={styles.mineBadge}>
              <Text style={styles.mineBadgeText}>Mine</Text>
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
          onPress={() => guardedReplace("/(app)/artist/artist-home")}
        >
          <Ionicons name="arrow-back" size={20} color="#2A1005" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>All Events</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => guardedPush("/(app)/events/create-event")}
        >
          <Ionicons name="add" size={20} color={COLORS.primary.deepRed} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "mine" && styles.tabActive]}
          onPress={() => setActiveTab("mine")}
        >
          <Ionicons
            name="person-outline"
            size={13}
            color={activeTab === "mine" ? "#fff" : COLORS.text.secondary}
          />
          <Text style={[styles.tabText, activeTab === "mine" && styles.tabTextActive]}>
            My Events
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === "all" && styles.tabActive]}
          onPress={() => setActiveTab("all")}
        >
          <Ionicons
            name="earth-outline"
            size={13}
            color={activeTab === "all" ? "#fff" : COLORS.text.secondary}
          />
          <Text style={[styles.tabText, activeTab === "all" && styles.tabTextActive]}>
            All Artists
          </Text>
        </TouchableOpacity>
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary.deepRed} />
        </View>
      ) : (
        <FlatList
          data={displayedEvents}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={renderEventCard}
          ListEmptyComponent={() => (
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={48} color="#C8BAA8" />
              <Text style={styles.emptyTitle}>
                {activeTab === "mine" ? "No events yet" : "No events found"}
              </Text>
              {activeTab === "mine" && (
                <TouchableOpacity
                  style={styles.createButton}
                  onPress={() => guardedPush("/(app)/events/create-event")}
                >
                  <Ionicons name="add" size={15} color="#fff" />
                  <Text style={styles.createButtonText}>Create Event</Text>
                </TouchableOpacity>
              )}
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
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(139,26,26,0.08)",
    justifyContent: "center",
    alignItems: "center",
  },

  // Tabs
  tabRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.light,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: COLORS.border.light,
  },
  tabActive: {
    backgroundColor: COLORS.primary.deepRed,
    borderColor: COLORS.primary.deepRed,
  },
  tabText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.text.secondary,
  },
  tabTextActive: {
    color: "#fff",
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
    marginBottom: 3,
  },
  eventSub: {
    fontSize: 12,
    color: COLORS.text.secondary,
    marginBottom: 2,
  },
  eventTime: {
    fontSize: 11,
    color: COLORS.text.muted,
  },
  eventRight: {
    alignItems: "flex-end",
    gap: 6,
  },
  mineBadge: {
    backgroundColor: COLORS.primary.deepRed,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  mineBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
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
  createButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.primary.deepRed,
    paddingVertical: 11,
    paddingHorizontal: 22,
    borderRadius: 22,
    marginTop: 4,
  },
  createButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
});
