import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useGuardedRouter } from "../../../utils/navigationGuard";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import type { ImageStyle, TextStyle, ViewStyle } from "react-native";

type ListingDetailsStyles = {
  container: ViewStyle;
  loadingContainer: ViewStyle;
  header: ViewStyle;
  backButton: ViewStyle;
  headerTitle: TextStyle;
  editButton: ViewStyle;
  content: ViewStyle;
  carouselContainer: ViewStyle;
  carouselImage: ImageStyle;
  imagePlaceholder: ViewStyle;
  pagination: ViewStyle;
  paginationDot: ViewStyle;
  paginationDotActive: ViewStyle;
  details: ViewStyle;
  listingTitle: TextStyle;
  soldBadge: ViewStyle;
  soldBadgeText: TextStyle;
  categoryBadge: ViewStyle;
  categoryBadgeText: TextStyle;
  price: TextStyle;
  soldPrice: TextStyle;
  statsRow: ViewStyle;
  statItem: ViewStyle;
  statText: TextStyle;
  divider: ViewStyle;
  section: ViewStyle;
  sectionTitle: TextStyle;
  description: TextStyle;
  inventoryRow: ViewStyle;
  inventoryCard: ViewStyle;
  inventoryValue: TextStyle;
  inventoryLabel: TextStyle;
};
import { SafeAreaView } from "react-native-safe-area-context";
import COLORS from "../../../constants/Colors";
import { db } from "../../../lib/firebase";
import { getCached, setCache, cacheKey } from "../../../lib/dataCache";
import type { Listing } from "../../../lib/types";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function ListingDetails() {
  const { id } = useLocalSearchParams();
  const { guardedPush, guardedReplace, guardedBack } = useGuardedRouter();

  const [listing, setListing] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeSlide, setActiveSlide] = useState(0);

  // ── Fetch listing ──
  useEffect(() => {
    if (id) fetchListingDetails();
  }, [id]);

  const fetchListingDetails = async () => {
    const cacheKeyStr = cacheKey('listing_details', id as string);
    const cached = getCached<Listing>(cacheKeyStr);
    if (cached) { setListing(cached); setLoading(false); return; }
    try {
      const docSnap = await getDoc(doc(db, "listings", id as string));
      if (docSnap.exists()) {
        const salesSnap = await getDocs(
          query(collection(db, "saleRecords"), where("listingId", "==", id))
        );
        const soldCount = salesSnap.docs.reduce(
          (acc, curr) => acc + (curr.data().quantity || 0),
          0
        );
        setListing({ id: docSnap.id, ...docSnap.data(), soldCount });
        setCache(cacheKey('listing_details', id as string), { id: docSnap.id, ...docSnap.data(), soldCount });
      } else {
        Alert.alert("Error", "Listing not found");
        guardedBack();
      }
    } catch {
      Alert.alert("Error", "Could not fetch listing details");
    } finally {
      setLoading(false);
    }
  };

  // ── Helpers ──
  const getDisplayImages = () => {
    if (listing?.images && listing.images.length > 0) return listing.images;
    return listing?.imageUrl ? [listing.imageUrl] : [];
  };

  // ── Loading state ──
  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary.deepRed} />
        </View>
      </SafeAreaView>
    );
  }

  if (!listing) return null;

  const images = getDisplayImages();

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => guardedBack()}>
          <Ionicons name="arrow-back" size={20} color={COLORS.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Listing Details</Text>
        <TouchableOpacity
          style={styles.editButton}
          onPress={() =>
            guardedPush({
              pathname: "/(app)/marketplace/edit-listing",
              params: { id: listing.id },
            })
          }
        >
          <Ionicons name="create-outline" size={20} color={COLORS.primary.deepRed} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>

        {/* Image carousel */}
        <View style={styles.carouselContainer}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={({ nativeEvent }) => {
              const slide = Math.ceil(
                nativeEvent.contentOffset.x / nativeEvent.layoutMeasurement.width
              );
              setActiveSlide(slide);
            }}
            scrollEventThrottle={16}
          >
            {images.length > 0 ? (
              images.map((img: string, index: number) => (
                <Image
                  key={index}
                  source={{ uri: img }}
                  style={styles.carouselImage}
                  resizeMode="cover"
                />
              ))
            ) : (
              <View style={styles.imagePlaceholder}>
                <Ionicons name="image-outline" size={64} color={COLORS.text.muted} />
              </View>
            )}
          </ScrollView>

          {images.length > 1 && (
            <View style={styles.pagination}>
              {images.map((_: any, index: number) => (
                <View
                  key={index}
                  style={[
                    styles.paginationDot,
                    index === activeSlide && styles.paginationDotActive,
                  ]}
                />
              ))}
            </View>
          )}
        </View>

        {/* Details */}
        <View style={styles.details}>
          <Text style={styles.listingTitle}>{listing.title}</Text>

          {/* Status badge */}
          {listing.status === "sold" && (
            <View style={styles.soldBadge}>
              <Text style={styles.soldBadgeText}>SOLD OUT</Text>
            </View>
          )}

          {/* Category badge */}
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryBadgeText}>{listing.category}</Text>
          </View>

          {/* Price */}
          <Text style={[styles.price, listing.status === "sold" && styles.soldPrice]}>
            ₱ {listing.price?.toLocaleString()}
          </Text>

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Ionicons name="eye-outline" size={18} color={COLORS.text.secondary} />
              <Text style={styles.statText}>{listing.views || 0} views</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="bookmark-outline" size={18} color={COLORS.text.secondary} />
              <Text style={styles.statText}>{listing.saves || 0} saves</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="share-social-outline" size={18} color={COLORS.text.secondary} />
              <Text style={styles.statText}>{listing.shares || 0} shares</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Description */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.description}>{listing.description}</Text>
          </View>

          <View style={styles.divider} />

          {/* Inventory */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Inventory</Text>
            <View style={styles.inventoryRow}>
              <View style={styles.inventoryCard}>
                <Text style={styles.inventoryValue}>{listing.currentQuantity || 0}</Text>
                <Text style={styles.inventoryLabel}>Available</Text>
              </View>
              <View style={styles.inventoryCard}>
                <Text style={styles.inventoryValue}>{listing.soldCount || 0}</Text>
                <Text style={styles.inventoryLabel}>Sold</Text>
              </View>
              <View style={styles.inventoryCard}>
                <Text style={styles.inventoryValue}>{listing.initialQuantity || 0}</Text>
                <Text style={styles.inventoryLabel}>Initial</Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ──
const styles = StyleSheet.create<ListingDetailsStyles>({
  container: {
    flex: 1,
    backgroundColor: COLORS.background.primary,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  // Header
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
  editButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(139,26,26,0.08)",
    justifyContent: "center",
    alignItems: "center",
  },

  // Content
  content: { flex: 1 },

  // Carousel
  carouselContainer: {
    height: SCREEN_WIDTH,
    position: "relative",
    backgroundColor: COLORS.background.secondary,
  },
  carouselImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH,
  },
  imagePlaceholder: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH,
    justifyContent: "center",
    alignItems: "center",
  },
  pagination: {
    position: "absolute",
    bottom: 16,
    width: "100%",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(0,0,0,0.3)",
    borderWidth: 1,
    borderColor: "#fff",
  },
  paginationDotActive: {
    width: 24,
    backgroundColor: COLORS.primary.deepRed,
    borderColor: "transparent",
  },

  // Details
  details: {
    padding: 24,
  },
  listingTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: COLORS.text.primary,
    marginBottom: 12,
  },
  soldBadge: {
    alignSelf: "flex-start",
    backgroundColor: COLORS.status.error.bg,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 12,
  },
  soldBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
  },
  categoryBadge: {
    alignSelf: "flex-start",
    backgroundColor: COLORS.background.secondary,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 14,
  },
  categoryBadgeText: {
    color: COLORS.text.secondary,
    fontSize: 13,
    fontWeight: "600",
  },
  price: {
    fontSize: 26,
    fontWeight: "800",
    color: COLORS.text.primary,
    marginBottom: 16,
  },
  soldPrice: {
    textDecorationLine: "line-through",
    opacity: 0.5,
  },

  // Stats
  statsRow: {
    flexDirection: "row",
    gap: 20,
    marginBottom: 4,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statText: {
    fontSize: 13,
    color: COLORS.text.secondary,
  },

  divider: {
    height: 1,
    backgroundColor: COLORS.border.light,
    marginVertical: 20,
  },

  // Section
  section: { marginBottom: 8 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.text.primary,
    marginBottom: 12,
  },
  description: {
    fontSize: 15,
    color: COLORS.text.secondary,
    lineHeight: 22,
  },

  // Inventory cards
  inventoryRow: {
    flexDirection: "row",
    gap: 12,
  },
  inventoryCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: COLORS.border.light,
  },
  inventoryValue: {
    fontSize: 24,
    fontWeight: "800",
    color: COLORS.text.primary,
    marginBottom: 4,
  },
  inventoryLabel: {
    fontSize: 12,
    color: COLORS.text.muted,
    fontWeight: "500",
  },
});
