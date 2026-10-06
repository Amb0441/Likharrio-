import { Feather } from "@expo/vector-icons";
import { useGuardedRouter } from "../../../utils/navigationGuard";
import {
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  SectionList,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import COLORS from "../../../constants/Colors";
import { useAuth } from "../../../contexts/AuthContext";
import { db } from "../../../lib/firebase";
import { getCached, setCache, cacheKey } from "../../../lib/dataCache";

// ── Types ──
interface Notification {
  id: string;
  type: "follow" | "like" | "comment" | "message" | "sale" | "event" | "listing" | "portfolio";
  title: string;
  body: string;
  read: boolean;
  createdAt: any;
  userId: string;
  fromUserId?: string;
  fromUserName?: string;
  fromUserAvatar?: string;
  targetId?: string;
  targetType?: string;
  imageUrl?: string;
}

// ── Icon map ──
const ICON_MAP: Record<string, { name: string; color: string; bg: string }> = {
  follow:    { name: "user-plus",      color: "#0EA5E9", bg: "#E0F2FE" },
  like:      { name: "heart",          color: "#8B1A1A", bg: "#FEF1EB" },
  comment:   { name: "message-circle", color: "#6B5946", bg: "#F5F1E8" },
  message:   { name: "mail",           color: "#D4A520", bg: "#FFF8E1" },
  sale:      { name: "shopping-bag",   color: "#2D5016", bg: "#E8F5E9" },
  event:     { name: "calendar",       color: "#7B3FA0", bg: "#F4EEF8" },
  listing:   { name: "tag",            color: "#2B5EA7", bg: "#EEF4FC" },
  portfolio: { name: "image",          color: "#8B1A1A", bg: "#FEF1EB" },
};

export default function NotificationsScreen() {
  const { user } = useAuth();
  const { guardedPush, guardedReplace, guardedBack } = useGuardedRouter();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  // ── Listener ──
  // Capped at 50 most recent — prevents fetching unbounded history on every open.
  useEffect(() => {
    if (!user) return;

    const cacheKeyStr = cacheKey('notifications', user.uid);
    const cached = getCached<Notification[]>(cacheKeyStr);
    if (cached) {
      setNotifications(cached);
      setLoading(false);
    }

    const q = query(
      collection(db, "notifications"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc"),
      limit(50),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const fetched = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
          createdAt: d.data().createdAt?.toDate() || new Date(),
        })) as Notification[];
        // already ordered desc from Firestore — no client-side sort needed
        setNotifications(fetched);
        setCache(cacheKey('notifications', user.uid), fetched);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, [user]);

  // ── Actions ──
  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, "notifications", id), { read: true });
    } catch {}
  };

  const markAllAsRead = async () => {
    try {
      await Promise.all(
        notifications
          .filter((n) => !n.read)
          .map((n) => updateDoc(doc(db, "notifications", n.id), { read: true }))
      );
    } catch {}
  };

  const deleteNotification = async (id: string) => {
    try {
      await deleteDoc(doc(db, "notifications", id));
    } catch {}
  };

  // ── Handle press ──
  const handlePress = async (n: Notification) => {
    if (!n.read) await markAsRead(n.id);

    switch (n.type) {
      case "message":
        guardedPush(
          n.targetId
            ? { pathname: "/(app)/chat/detail", params: { id: n.targetId } }
            : ("/(app)/chat" as any)
        );
        break;
      case "follow":
        if (n.fromUserId)
          guardedPush({
            pathname: "/(app)/artist/artist-profile-view",
            params: { id: n.fromUserId },
          });
        break;
      case "like":
      case "comment":
        if (n.targetType === "portfolio" && n.targetId)
          guardedPush({ pathname: "/(app)/showcase/showcase-detail", params: { id: n.targetId } });
        else if (n.targetType === "listing" && n.targetId)
          guardedPush({ pathname: "/(app)/marketplace/listing-details", params: { id: n.targetId } });
        break;
      case "sale":
      case "listing":
        if (n.targetId)
          guardedPush({ pathname: "/(app)/marketplace/listing-details", params: { id: n.targetId } });
        break;
      case "portfolio":
        if (n.targetId)
          guardedPush({ pathname: "/(app)/showcase/showcase-detail", params: { id: n.targetId } });
        break;
      case "event":
        if (n.targetId)
          guardedPush({ pathname: "/(app)/events/event-detail", params: { id: n.targetId } });
        break;
    }
  };

  // ── Helpers ──
  const formatTimestamp = (date: Date) => {
    const diff = Date.now() - date.getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const isToday = (date: Date) => {
    const now = new Date();
    return (
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear()
    );
  };

  // ── Derived data ──
  const filtered =
    filter === "unread" ? notifications.filter((n) => !n.read) : notifications;
  const unreadCount = notifications.filter((n) => !n.read).length;

  const todayItems = filtered.filter((n) => isToday(n.createdAt));
  const earlierItems = filtered.filter((n) => !isToday(n.createdAt));

  const sections = [
    ...(todayItems.length > 0 ? [{ title: "Today", data: todayItems }] : []),
    ...(earlierItems.length > 0 ? [{ title: "Earlier", data: earlierItems }] : []),
  ];

  // ── Render notification card ──
  const renderItem = ({ item }: { item: Notification }) => {
    const icon = ICON_MAP[item.type] || { name: "bell", color: COLORS.primary.deepRed, bg: "#FEF1EB" };

    return (
      <TouchableOpacity
        style={[styles.card, !item.read && styles.cardUnread]}
        onPress={() => handlePress(item)}
        activeOpacity={0.75}
      >
        {!item.read && <View style={styles.unreadBar} />}

        <View style={styles.cardInner}>
          <View style={[styles.iconBox, { backgroundColor: icon.bg }]}>
            <Feather name={icon.name as any} size={20} color={icon.color} />
          </View>

          <View style={styles.textWrap}>
            <View style={styles.titleRow}>
              <Text style={styles.notifTitle} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.timestamp}>
                {formatTimestamp(item.createdAt)}
              </Text>
            </View>
            <Text style={styles.notifBody} numberOfLines={2}>
              {item.body}
            </Text>
          </View>

          {item.imageUrl && (
            <Image
              source={{ uri: item.imageUrl }}
              style={styles.thumbnail}
              resizeMode="cover"
            />
          )}

          {!item.read && <View style={styles.unreadDot} />}

          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={(e) => {
              e.stopPropagation();
              deleteNotification(item.id);
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name="x" size={14} color="#C8BAA8" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  // ── Render section header ──
  const renderSectionHeader = ({ section }: { section: { title: string } }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionLabel}>{section.title}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background.primary} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => guardedBack()}
          activeOpacity={0.7}
        >
          <Feather name="arrow-left" size={18} color={COLORS.text.primary} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Notifications</Text>
          {unreadCount > 0 && (
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>

        {unreadCount > 0 ? (
          <TouchableOpacity onPress={markAllAsRead} style={styles.markAllBtn}>
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 88 }} />
        )}
      </View>

      {/* Filter tabs */}
      <View style={styles.filterRow}>
        {(["all", "unread"] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.filterTab, filter === tab && styles.filterTabActive]}
            onPress={() => setFilter(tab)}
          >
            <Text style={[styles.filterText, filter === tab && styles.filterTextActive]}>
              {tab === "all" ? "All" : "Unread"}
            </Text>

            {tab === "all" && notifications.length > 0 && (
              <View style={[styles.filterBadge, filter === "all" && styles.filterBadgeActive]}>
                <Text style={[styles.filterBadgeText, filter === "all" && styles.filterBadgeTextActive]}>
                  {notifications.length}
                </Text>
              </View>
            )}

            {tab === "unread" && unreadCount > 0 && (
              <View style={[styles.filterBadge, filter === "unread" && styles.filterBadgeActive]}>
                <Text style={[styles.filterBadgeText, filter === "unread" && styles.filterBadgeTextActive]}>
                  {unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.primary.deepRed} />
          <Text style={styles.loadingText}>Loading notifications…</Text>
        </View>
      ) : filtered.length > 0 ? (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
        />
      ) : (
        <View style={styles.emptyWrap}>
          <View style={styles.emptyIconCircle}>
            <Feather
              name={filter === "unread" ? "check-circle" : "bell"}
              size={40}
              color="#C8BAA8"
            />
          </View>
          <Text style={styles.emptyTitle}>
            {filter === "unread" ? "You're all caught up!" : "No notifications yet"}
          </Text>
          <Text style={styles.emptySub}>
            {filter === "unread"
              ? "Check back later for new updates"
              : "When you get notifications, they'll show up here"}
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

// ── Styles ──
const styles = StyleSheet.create({
  root: {
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
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border.light,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: COLORS.text.primary,
  },
  headerBadge: {
    backgroundColor: COLORS.primary.deepRed,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  headerBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "800",
  },
  markAllBtn: {
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  markAllText: {
    fontSize: 13,
    color: COLORS.primary.deepRed,
    fontWeight: "700",
  },

  // Filter tabs
  filterRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.light,
  },
  filterTab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: COLORS.border.light,
  },
  filterTabActive: {
    backgroundColor: COLORS.primary.deepRed,
    borderColor: COLORS.primary.deepRed,
  },
  filterText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.text.secondary,
  },
  filterTextActive: {
    color: "#fff",
  },
  filterBadge: {
    backgroundColor: "#F5F1E8",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 22,
    alignItems: "center",
  },
  filterBadgeActive: {
    backgroundColor: "rgba(255,255,255,0.25)",
  },
  filterBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.text.secondary,
  },
  filterBadgeTextActive: {
    color: "#fff",
  },

  // Section header
  sectionHeader: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 6,
    backgroundColor: COLORS.background.primary,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.text.secondary,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },

  // Loading
  loadingWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: COLORS.text.secondary,
  },

  // List
  list: {
    paddingBottom: 32,
  },

  // Notification card
  card: {
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#F0E8E0",
    position: "relative",
    overflow: "hidden",
  },
  cardUnread: {
    backgroundColor: "#FFFAF7",
  },
  unreadBar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: COLORS.primary.deepRed,
  },
  cardInner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  textWrap: {
    flex: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  notifTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.text.primary,
    flex: 1,
    marginRight: 8,
  },
  timestamp: {
    fontSize: 11,
    color: "#B8A99A",
    flexShrink: 0,
  },
  notifBody: {
    fontSize: 13,
    color: COLORS.text.secondary,
    lineHeight: 18,
  },
  thumbnail: {
    width: 50,
    height: 50,
    borderRadius: 12,
    flexShrink: 0,
    borderWidth: 1,
    borderColor: COLORS.border.light,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary.deepRed,
    flexShrink: 0,
  },
  deleteBtn: {
    padding: 4,
    flexShrink: 0,
  },

  // Empty state
  emptyWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "#F5F1E8",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.text.primary,
    textAlign: "center",
  },
  emptySub: {
    fontSize: 14,
    color: COLORS.text.secondary,
    textAlign: "center",
    lineHeight: 21,
  },
});
