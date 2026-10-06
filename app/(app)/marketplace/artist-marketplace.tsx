import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import COLORS from "../../../constants/Colors";
import { useAuth } from "../../../contexts/AuthContext";
import { db } from "../../../lib/firebase";
import { getCached, setCache, cacheKey } from "../../../lib/dataCache";
import VerificationGateModal from "../../../components/ui/VerificationGateModal";
import { useArtistVerification } from "../../../hooks/useArtistVerification";
import { useLayoutMode, useMeasuredWidth } from "../../../hooks/useLayoutMode";

const ITEMS_PER_PAGE = 3;

const CATEGORIES = [
  "All",
  "Painting",
  "Drawing & Illustration",
  "Weaving & Textiles",
  "Wood Craft",
  "Sculpture",
  "Other",
];

// ── Types ──
interface Listing {
  id: string;
  title: string;
  description: string;
  category: string;
  price: number;
  imageUrl?: string;
  images?: string[];
  createdAt: any;
  saves?: number;
  views?: number;
  shares?: number;
  initialQuantity?: number;
  currentQuantity?: number;
  soldCount?: number;
  status: string;
}

interface Analytics {
  totalSold: number;
  totalSaves: number;
  totalViews: number;
  totalShares: number;
}

const ANALYTICS_ITEMS = [
  { icon: "cart-outline",         label: "Total Sold",  key: "totalSold",   color: "#2D7D57" },
  { icon: "bookmark-outline",     label: "Total Saves", key: "totalSaves",  color: "#C47A1A" },
  { icon: "eye-outline",          label: "Total Views", key: "totalViews",  color: "#1A5FC4" },
  { icon: "share-social-outline", label: "Shares",      key: "totalShares", color: "#7B4AC4" },
] as const;

export default function ArtistMarketplace() {
  const { user } = useAuth();
  const { isWebsite } = useLayoutMode();
  const { canCreate, isPending, blockMessage } = useArtistVerification();
  const { width: pageWidth, onLayout: onPagerLayout } = useMeasuredWidth();

  const [gateVisible, setGateVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [isNavigating, setIsNavigating] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [analytics, setAnalytics] = useState<Analytics>({
    totalSold: 0,
    totalSaves: 0,
    totalViews: 0,
    totalShares: 0,
  });

  // ── Focus effects ──
  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      const key = cacheKey('artist_listings', user.uid);
      const cached = getCached<{ listings: Listing[]; analytics: Analytics }>(key);
      if (cached) {
        setListings(cached.listings);
        setAnalytics(cached.analytics);
        setLoading(false);
        return;
      }
      fetchListings();
    }, [user])
  );

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      getDocs(
        query(
          collection(db, "notifications"),
          where("userId", "==", user.uid),
          where("read", "==", false)
        )
      ).then((snap) => setUnreadCount(snap.size));
    }, [user])
  );

  // ── Navigation ──
  const handleNavigation = (path: any, params?: any) => {
    if (isNavigating) return;
    setIsNavigating(true);
    params ? router.push({ pathname: path, params }) : router.push(path);
    setTimeout(() => setIsNavigating(false), 1500);
  };

  const tryCreate = () => {
    if (!canCreate) {
      setGateVisible(true);
      return;
    }
    handleNavigation("/(app)/marketplace/listing-items");
  };

  // ── Fetch listings ──
  const fetchListings = async () => {
    if (!user) return;
    try {
      if (listings.length === 0) setLoading(true);

      const snapshot = await getDocs(
        query(collection(db, "listings"), where("artistId", "==", user.uid))
      );
      let fetched = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as Listing[];

      try {
        const salesSnap = await getDocs(
          query(collection(db, "saleRecords"), where("artistId", "==", user.uid))
        );
        const salesMap = new Map<string, number>();
        salesSnap.docs.forEach((d) => {
          const { listingId, quantity } = d.data();
          salesMap.set(listingId, (salesMap.get(listingId) || 0) + quantity);
        });
        fetched = fetched.map((l) => ({
          ...l,
          soldCount: salesMap.get(l.id) || l.soldCount || 0,
        }));
      } catch {}

      setListings(fetched);
      const analyticsData = {
        totalSaves:  fetched.reduce((s, l) => s + (l.saves    || 0), 0),
        totalViews:  fetched.reduce((s, l) => s + (l.views    || 0), 0),
        totalShares: fetched.reduce((s, l) => s + (l.shares   || 0), 0),
        totalSold:   fetched.reduce((s, l) => s + (l.soldCount || 0), 0),
      };
      setAnalytics(analyticsData);
      setCache(cacheKey('artist_listings', user!.uid), { listings: fetched, analytics: analyticsData });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // ── Derived data ──
  const filteredListings = listings.filter((l) => {
    const matchSearch =
      l.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchCat = selectedCategory === "All" || l.category === selectedCategory;
    return matchSearch && matchCat;
  });

  const totalPages = Math.ceil(filteredListings.length / ITEMS_PER_PAGE);
  const paginatedListings = Array.from({ length: totalPages }, (_, i) =>
    filteredListings.slice(i * ITEMS_PER_PAGE, (i + 1) * ITEMS_PER_PAGE)
  );

  const handleScroll = (e: any) => {
    if (!pageWidth) return;
    setCurrentPage(Math.round(e.nativeEvent.contentOffset.x / pageWidth));
  };

  // ── Render listing row ──
  const renderListingRow = (listing: Listing) => (
    <TouchableOpacity
      key={listing.id}
      style={styles.listingRow}
      onPress={() =>
        handleNavigation("/(app)/marketplace/listing-details", {
          id: listing.id,
        })
      }
      disabled={isNavigating}
      activeOpacity={0.75}
    >
      <View style={styles.listingThumbWrap}>
        <Image
          source={{ uri: listing.imageUrl }}
          style={styles.listingThumb}
          resizeMode="cover"
        />
        {listing.status === "sold" && (
          <View style={styles.soldOverlay}>
            <Text style={styles.soldText}>SOLD</Text>
          </View>
        )}
      </View>

      <View style={styles.listingInfo}>
        <Text style={styles.listingTitle} numberOfLines={1}>
          {listing.title}
        </Text>
        <Text style={[styles.listingPrice, listing.status === "sold" && styles.soldPrice]}>
          ₱{listing.price.toLocaleString()}
        </Text>
        <View style={styles.listingMeta}>
          <View style={styles.metaItem}>
            <Ionicons name="eye-outline" size={12} color={COLORS.text.secondary} />
            <Text style={styles.metaText}>{listing.views || 0}</Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="bookmark-outline" size={12} color={COLORS.text.secondary} />
            <Text style={styles.metaText}>{listing.saves || 0}</Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="share-social-outline" size={12} color={COLORS.text.secondary} />
            <Text style={styles.metaText}>{listing.shares || 0}</Text>
          </View>
        </View>
      </View>

      <Ionicons name="chevron-forward" size={16} color="#C8BAA8" />
    </TouchableOpacity>
  );

  // ── Loading state ──
  if (loading) {
    return (
      <SafeAreaView style={styles.root}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.primary.deepRed} />
          <Text style={styles.loadingText}>Loading listings…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={isWebsite ? [] : ["top"]}>
      <StatusBar barStyle="dark-content" />

      {!isWebsite && (
        <View style={styles.header}>
          <View>
            <Text style={styles.headerSub}>Your shop</Text>
            <Text style={styles.headerTitle}>Marketplace</Text>
          </View>
          <TouchableOpacity
            style={styles.notifBtn}
            onPress={() => router.push("/(app)/notifications")}
          >
            <Ionicons name="notifications-outline" size={22} color={COLORS.text.primary} />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {unreadCount > 99 ? "99+" : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      )}

      <View style={isWebsite ? styles.webFrame : styles.phoneFrame}>
      {isWebsite && (
        <View style={styles.webHead}>
          <Text style={styles.headerSub}>Your shop</Text>
          <Text style={styles.webTitle}>Marketplace</Text>
        </View>
      )}

      {/* Search + Filter */}
      <View style={styles.searchRow}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={COLORS.text.secondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search your listings…"
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#B8A99A"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={16} color="#B8A99A" />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={styles.filterBtn}
          onPress={() => setShowCategoryModal(true)}
        >
          <Ionicons name="options-outline" size={20} color={COLORS.text.primary} />
          {selectedCategory !== "All" && <View style={styles.filterDot} />}
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Listings section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Active Listings</Text>
            <TouchableOpacity onPress={tryCreate} disabled={isNavigating}>
              <View style={[styles.createBtn, !canCreate && styles.createBtnLocked]}>
                <Ionicons
                  name={canCreate ? "add" : "lock-closed"}
                  size={14}
                  color={canCreate ? "#fff" : "#9CA3AF"}
                />
                <Text style={[styles.createBtnText, !canCreate && styles.createBtnTextLocked]}>
                  {canCreate ? "Create" : "Locked"}
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          <View style={styles.listingsBoard}>
            {/* Empty — no listings at all */}
            {filteredListings.length === 0 && !searchQuery && (
              <View style={styles.emptyBox}>
                <View style={styles.emptyIconWrap}>
                  <Ionicons name="cube-outline" size={32} color={COLORS.primary.deepRed} />
                </View>
                <Text style={styles.emptyTitle}>No listings yet</Text>
                <Text style={styles.emptySub}>Create your first listing to start selling</Text>
                <TouchableOpacity
                  style={[styles.emptyBtn, !canCreate && styles.emptyBtnLocked]}
                  onPress={tryCreate}
                  disabled={isNavigating}
                >
                  <Text style={styles.emptyBtnText}>
                    {canCreate ? "Create Listing" : "🔒 Verify to Create"}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Empty — no search results */}
            {filteredListings.length === 0 && searchQuery.length > 0 && (
              <View style={styles.emptyBox}>
                <Ionicons name="search-outline" size={32} color="#C8BAA8" />
                <Text style={styles.emptyTitle}>No results found</Text>
                <Text style={styles.emptySub}>Try a different search term</Text>
              </View>
            )}

            {/* Paginated listing rows */}
            {filteredListings.length > 0 && (
              <>
                <ScrollView
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onScroll={handleScroll}
                  scrollEventThrottle={16}
                  onLayout={onPagerLayout}
                >
                  {paginatedListings.map((page, pageIdx) => (
                    <View key={pageIdx} style={[styles.page, { width: pageWidth }]}>
                      {page.map(renderListingRow)}
                      {Array.from({ length: ITEMS_PER_PAGE - page.length }).map((_, i) => (
                        <View key={`spacer-${i}`} style={[styles.listingRow, styles.listingRowSpacer]} />
                      ))}
                    </View>
                  ))}
                </ScrollView>

                {totalPages > 1 && (
                  <View style={styles.dotsRow}>
                    {Array.from({ length: totalPages }).map((_, i) => (
                      <View key={i} style={[styles.dot, i === currentPage && styles.dotActive]} />
                    ))}
                  </View>
                )}
              </>
            )}
          </View>
        </View>

        {/* Analytics section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.analyticsTitleRow}>
              <Ionicons name="bar-chart" size={17} color={COLORS.primary.deepRed} />
              <Text style={styles.sectionTitle}>Analytics</Text>
            </View>
            <View style={styles.livePill}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>Live</Text>
            </View>
          </View>

          <View style={styles.analyticsCard}>
            {ANALYTICS_ITEMS.map((item, i) => (
              <View
                key={item.key}
                style={[styles.analyticsRow, i < ANALYTICS_ITEMS.length - 1 && styles.analyticsRowBorder]}
              >
                <View style={[styles.analyticsIcon, { backgroundColor: item.color + "18" }]}>
                  <Ionicons name={item.icon as any} size={16} color={item.color} />
                </View>
                <Text style={styles.analyticsLabel}>{item.label}</Text>
                <Text style={[styles.analyticsValue, { color: item.color }]}>
                  {analytics[item.key]}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
      </View>

      {/* Verification gate */}
      <VerificationGateModal
        visible={gateVisible}
        onClose={() => setGateVisible(false)}
        title={blockMessage.title}
        message={blockMessage.message}
        actionLabel={blockMessage.actionLabel}
        actionRoute={blockMessage.actionRoute}
        isPending={isPending}
      />

      {/* Category filter modal */}
      <Modal
        visible={showCategoryModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCategoryModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter by Category</Text>
              <TouchableOpacity onPress={() => setShowCategoryModal(false)}>
                <Ionicons name="close" size={22} color={COLORS.text.primary} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.catOption, selectedCategory === cat && styles.catOptionActive]}
                  onPress={() => {
                    setSelectedCategory(cat);
                    setShowCategoryModal(false);
                  }}
                >
                  <Text style={[styles.catOptionText, selectedCategory === cat && styles.catOptionTextActive]}>
                    {cat}
                  </Text>
                  {selectedCategory === cat && (
                    <Ionicons name="checkmark" size={20} color={COLORS.primary.deepRed} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ── Styles ──
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background.primary,
  },
  scrollContent: {
    paddingBottom: 32,
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

  // Header
  phoneFrame: {
    flex: 1,
  },
  webFrame: {
    flex: 1,
    width: "100%",
    maxWidth: 1180,
    alignSelf: "center",
  },
  webHead: {
    paddingHorizontal: 28,
    paddingTop: 28,
    paddingBottom: 4,
  },
  webTitle: {
    fontSize: 32,
    fontWeight: "800",
    color: COLORS.text.primary,
    letterSpacing: -0.6,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.light,
    backgroundColor: COLORS.background.primary,
  },
  headerSub: {
    fontSize: 12,
    color: COLORS.text.secondary,
    fontWeight: "500",
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: COLORS.text.primary,
    letterSpacing: -0.3,
  },
  notifBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: COLORS.border.light,
    position: "relative",
  },
  badge: {
    position: "absolute",
    top: -2,
    right: -2,
    backgroundColor: COLORS.primary.deepRed,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  badgeText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "800",
  },

  // Search
  searchRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.border.light,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text.primary,
    paddingVertical: 0,
  },
  filterBtn: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: COLORS.border.light,
  },
  filterDot: {
    position: "absolute",
    top: 9,
    right: 9,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: COLORS.primary.deepRed,
  },

  // Section
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: COLORS.text.primary,
  },

  // Create button
  createBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: COLORS.primary.deepRed,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  createBtnLocked: {
    backgroundColor: "#F3F4F6",
  },
  createBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fff",
  },
  createBtnTextLocked: {
    color: "#9CA3AF",
  },

  // Listings board
  listingsBoard: {
    backgroundColor: "#F5EFE8",
    borderRadius: 16,
    padding: 12,
    minHeight: 120,
  },
  page: {
    gap: 2,
  },

  // Listing row
  listingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border.light,
    marginBottom: 8,
  },
  listingRowSpacer: {
    opacity: 0,
  },
  listingThumbWrap: {
    position: "relative",
    flexShrink: 0,
  },
  listingThumb: {
    width: 68,
    height: 68,
    borderRadius: 12,
    backgroundColor: COLORS.border.light,
  },
  soldOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  soldText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  listingInfo: {
    flex: 1,
  },
  listingTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.text.primary,
    marginBottom: 3,
  },
  listingPrice: {
    fontSize: 14,
    color: COLORS.primary.deepRed,
    fontWeight: "700",
    marginBottom: 6,
  },
  soldPrice: {
    textDecorationLine: "line-through",
    opacity: 0.5,
  },
  listingMeta: {
    flexDirection: "row",
    gap: 12,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 11,
    color: COLORS.text.secondary,
  },

  // Pagination dots
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    paddingTop: 10,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#D0C4B8",
  },
  dotActive: {
    width: 18,
    backgroundColor: COLORS.primary.deepRed,
    borderRadius: 3,
  },

  // Empty state
  emptyBox: {
    alignItems: "center",
    paddingVertical: 32,
    gap: 8,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "rgba(139,26,26,0.08)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.text.primary,
  },
  emptySub: {
    fontSize: 12,
    color: COLORS.text.secondary,
    textAlign: "center",
  },
  emptyBtn: {
    marginTop: 8,
    backgroundColor: COLORS.primary.deepRed,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 22,
  },
  emptyBtnLocked: {
    backgroundColor: "#9CA3AF",
  },
  emptyBtnText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },

  // Analytics
  analyticsTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  analyticsCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderWidth: 1.5,
    borderColor: COLORS.border.light,
  },
  livePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(139,26,26,0.08)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.primary.deepRed,
  },
  liveText: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.primary.deepRed,
  },
  analyticsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 13,
  },
  analyticsRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "#F5EFE8",
  },
  analyticsIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  analyticsLabel: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text.secondary,
    fontWeight: "500",
  },
  analyticsValue: {
    fontSize: 17,
    fontWeight: "800",
  },

  // Category modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: COLORS.background.primary,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingBottom: 40,
    maxHeight: "75%",
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#D0C4B8",
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 4,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.light,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: COLORS.text.primary,
  },
  catOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F5EFE8",
  },
  catOptionActive: {
    backgroundColor: "rgba(139,26,26,0.05)",
  },
  catOptionText: {
    fontSize: 15,
    color: COLORS.text.primary,
  },
  catOptionTextActive: {
    fontWeight: "700",
    color: COLORS.primary.deepRed,
  },
});
