import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  collection,
  limit,
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
  Image,
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
interface Portfolio {
  id: string;
  title: string;
  description: string;
  coverImage: string;
  likes: number;
  views: number;
  category: string;
  createdAt: any;
  artistId: string;
}

export default function ShowcaseAll() {
  const { user } = useAuth();
  const router = useRouter();

  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [loading, setLoading] = useState(true);

  const isNavigating = useRef(false);

  // ── Navigation helpers ──
  const safeNavigate = (pathname: string, params: any) => {
    if (isNavigating.current) return;
    isNavigating.current = true;
    router.push({ pathname: pathname as any, params });
    setTimeout(() => { isNavigating.current = false; }, 1000);
  };

  const safeBack = () => {
    if (isNavigating.current) return;
    isNavigating.current = true;
    router.replace("/(app)/artist/artist-home");
    setTimeout(() => { isNavigating.current = false; }, 1000);
  };

  // ── Hardware back ──
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      safeBack();
      return true;
    });
    return () => sub.remove();
  }, []);

  // ── Listener ──
  // Capped at 50 — prevents fetching an unbounded portfolio list as the artist posts more.
  useEffect(() => {
    if (!user) return;

    const cacheKeyStr = cacheKey('showcase_all', user.uid);
    const cached = getCached<Portfolio[]>(cacheKeyStr);
    if (cached) {
      setPortfolios(cached);
      setLoading(false);
    }

    const q = query(
      collection(db, "portfolios"),
      where("artistId", "==", user.uid),
      orderBy("createdAt", "desc"),
      limit(50),
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as Portfolio[];
      setPortfolios(fetched);
      setCache(cacheKey('showcase_all', user.uid), fetched);
      setLoading(false);
    });
    return () => unsub();
  }, [user]);

  // ── Helpers ──
  const formatDate = (timestamp: any) => {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // ── Render portfolio card ──
  const renderCard = ({ item }: { item: Portfolio }) => {
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() =>
          safeNavigate("/(app)/showcase/showcase-detail", { id: item.id })
        }
        activeOpacity={0.82}
      >
        {/* Cover image */}
        <View style={styles.cardImageWrap}>
          {item.coverImage ? (
            <Image
              source={{ uri: item.coverImage }}
              style={styles.cardImage}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.cardImage, styles.cardImageFallback]} />
          )}
          {item.category && (
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{item.category}</Text>
            </View>
          )}
        </View>

        {/* Card body */}
        <View style={styles.cardBody}>

          {/* Title + inline stats */}
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <View style={styles.statsInline}>
              <View style={styles.statItem}>
                <Ionicons name="heart" size={13} color={COLORS.primary.deepRed} />
                <Text style={styles.statText}>{item.likes || 0}</Text>
              </View>
              <View style={styles.statItem}>
                <Ionicons name="eye" size={13} color={COLORS.text.secondary} />
                <Text style={styles.statText}>{item.views || 0}</Text>
              </View>
            </View>
          </View>

          {/* Description */}
          {item.description ? (
            <Text style={styles.cardDesc} numberOfLines={2}>
              {item.description}
            </Text>
          ) : null}

          {/* Date */}
          <Text style={styles.cardDate}>{formatDate(item.createdAt)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={safeBack} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color={COLORS.text.primary} />
        </TouchableOpacity>
        <View style={styles.headerTextWrap}>
          <Text style={styles.headerTitle}>All Showcases</Text>
          {!loading && (
            <Text style={styles.headerSubtitle}>
              {portfolios.length} {portfolios.length === 1 ? "piece" : "pieces"}
            </Text>
          )}
        </View>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.primary.deepRed} />
        </View>
      ) : (
        <FlatList
          data={portfolios}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={renderCard}
          ListEmptyComponent={() => (
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="images-outline" size={40} color={COLORS.primary.deepRed} />
              </View>
              <Text style={styles.emptyTitle}>No showcases yet</Text>
              <Text style={styles.emptySubtitle}>
                Pieces you share will appear here for everyone to discover.
              </Text>
            </View>
          )}
        />
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
    borderRadius: 10,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: COLORS.border.light,
  },
  headerTextWrap: {
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: COLORS.text.primary,
    letterSpacing: 0.2,
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.text.muted,
    marginTop: 2,
  },

  // Loading
  loadingWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  // List
  list: {
    padding: 20,
    gap: 16,
  },

  // Card
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORS.border.light,
    shadowColor: "#2A1005",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3,
  },
  cardImageWrap: {
    height: 200,
    position: "relative",
  },
  cardImage: {
    width: "100%",
    height: "100%",
  },
  cardImageFallback: {
    backgroundColor: COLORS.border.light,
  },
  categoryBadge: {
    position: "absolute",
    top: 14,
    left: 14,
    backgroundColor: "rgba(26,5,5,0.7)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  categoryText: {
    color: "#FAF3E8",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "capitalize",
    letterSpacing: 0.3,
  },

  // Card body
  cardBody: {
    padding: 16,
    gap: 6,
  },

  // Artist row
  artistRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  artistAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  artistAvatarFallback: {
    backgroundColor: COLORS.primary.deepRed,
    justifyContent: "center",
    alignItems: "center",
  },
  artistAvatarText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#fff",
  },
  artistName: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.text.secondary,
    flex: 1,
  },

  // Title + stats
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.text.primary,
    flex: 1,
    letterSpacing: 0.1,
  },
  statsInline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 0,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: COLORS.background.secondary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  statText: {
    fontSize: 12,
    color: COLORS.text.secondary,
    fontWeight: "700",
  },

  // Description & date
  cardDesc: {
    fontSize: 13,
    color: COLORS.text.secondary,
    lineHeight: 19,
  },
  cardDate: {
    fontSize: 11,
    color: COLORS.text.muted,
    marginTop: 2,
  },

  // Empty state
  emptyWrap: {
    alignItems: "center",
    marginTop: 100,
    gap: 12,
    paddingHorizontal: 40,
  },
  emptyIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: COLORS.ui.showcaseSection,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 16,
    color: COLORS.text.primary,
    fontWeight: "700",
  },
  emptySubtitle: {
    fontSize: 13,
    color: COLORS.text.muted,
    textAlign: "center",
    lineHeight: 19,
  },
});
