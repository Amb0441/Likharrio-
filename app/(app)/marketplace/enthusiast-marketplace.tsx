import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useGuardedRouter } from "../../../utils/navigationGuard";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  ScrollView,
  Share,
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
import { useLayoutMode } from "../../../hooks/useLayoutMode";
import { showGuestAlert } from "../../../lib/helpers";
import type { Listing, ArtistProfile } from "../../../lib/types";
import {
  trackShare,
  trackView,
} from "../../../utils/recommendations/recommendationEngine";
import { toggleLike } from "../../../lib/services/userActivity";
import ArtworkDetailsModal from "../../../components/modals/ArtworkDetailsModal";
import FilterBar from "../../../components/marketplace/FilterBar";
import ListingGrid from "../../../components/marketplace/ListingGrid";

const CATEGORIES = [
  "All",
  "Painting",
  "Drawing & Illustration",
  "Weaving & Textiles",
  "Wood Craft",
  "Sculpture",
  "Other",
];

export default function EnthusiastMarketplace() {
  const router = useRouter();
  const { guardedPush, guardedReplace } = useGuardedRouter();
  const params = useLocalSearchParams();
  const { user, isGuestMode, userProfile } = useAuth();
  const { isWebsite } = useLayoutMode();

  const isNavigating = useRef(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedListing, setSelectedListing] =
    useState<Listing | null>(null);
  const [userSaves, setUserSaves] = useState<Set<string>>(new Set());
  const [userLikes, setUserLikes] = useState<Set<string>>(new Set());
  const [unreadCount, setUnreadCount] = useState(0);
  const [artistName, setArtistName] = useState("");

  const [selectedCategory, setSelectedCategory] = useState("All");
  const [artistProfiles, setArtistProfiles] = useState<
    Record<string, ArtistProfile>
  >({});
  const artistProfileCache = useRef<Record<string, ArtistProfile>>({});

  useEffect(() => {
    if (isNavigating.current) return;
    if (
      params.selectedListingId &&
      listings.length > 0 &&
      !selectedListing
    ) {
      const listing = listings.find(
        (l) => l.id === params.selectedListingId,
      );
      if (listing) handleListingPress(listing);
    }
  }, [params.selectedListingId, listings, selectedListing]);

  useEffect(() => {
    fetchListings();
    if (!user) return;

    const savedUnsub = onSnapshot(
      query(
        collection(db, "saves"),
        where("userId", "==", user.uid),
      ),
      (snap) => {
        setUserSaves(
          new Set(
            snap.docs.map(
              (d) => d.data().listingId || d.data().targetId,
            ),
          ),
        );
      },
    );

    const likesUnsub = onSnapshot(
      query(
        collection(db, "user_likes"),
        where("userId", "==", user.uid),
      ),
      (snap) => {
        setUserLikes(
          new Set(
            snap.docs.map((d) => {
              const data = d.data();
              return data.itemId || data.targetId;
            }),
          ),
        );
      },
    );

    const notifsUnsub = onSnapshot(
      query(
        collection(db, "notifications"),
        where("userId", "==", user.uid),
        where("read", "==", false),
      ),
      (snap) => setUnreadCount(snap.size),
    );

    return () => {
      savedUnsub();
      likesUnsub();
      notifsUnsub();
    };
  }, [user]);

  const fetchListings = async (forceRefresh = false) => {
    try {
      const key = cacheKey("marketplace_listings");
      if (!forceRefresh) {
        const cached = getCached<Listing[]>(key);
        if (cached) {
          setListings(cached);
          setLoading(false);
          return;
        }
      }
      setLoading(true);

      const snap = await getDocs(
        query(
          collection(db, "listings"),
          orderBy("createdAt", "desc"),
        ),
      );
      const fetched = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          title: data.title || "",
          description: data.description || "",
          category: data.category || "",
          price: data.price || 0,
          imageUrl: data.imageUrl || data.images?.[0] || "",
          images: data.images || [],
          saves: data.saves || 0,
          views: data.views || 0,
          artistId: data.artistId || "",
          artistEmail: data.artistEmail || "",
          status: data.status || "available",
          createdAt: data.createdAt || null,
        } as Listing;
      });
      setListings(fetched);
      setCache(key, fetched);

      const uniqueIds = [
        ...new Set(
          fetched.map((l) => l.artistId).filter(Boolean),
        ),
      ];
      const uncachedIds = uniqueIds.filter(
        (id) => !artistProfileCache.current[id],
      );

      if (uncachedIds.length > 0) {
        const newEntries: Record<string, ArtistProfile> = {};
        await Promise.all(
          uncachedIds.map(async (id) => {
            try {
              const d = await getDoc(doc(db, "users", id));
              if (d.exists()) {
                const data = d.data();
                newEntries[id] = {
                  id,
                  displayName:
                    data.displayName ||
                    data.name ||
                    "Unknown Artist",
                  profileImage: data.profileImage,
                  artistType: data.artistType,
                };
              }
            } catch (e) {
              console.error(
                "Failed to fetch artist profile",
                e,
              );
            }
          }),
        );
        Object.assign(
          artistProfileCache.current,
          newEntries,
        );
      }
      setArtistProfiles({ ...artistProfileCache.current });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleListingPress = async (listing: Listing) => {
    if (isNavigating.current) return;
    isNavigating.current = true;
    setSelectedListing(listing);
    if (user) trackView(user.uid, listing.id);
    setTimeout(() => {
      isNavigating.current = false;
    }, 800);

    if (listing.artistId) {
      try {
        const d = await getDoc(
          doc(db, "users", listing.artistId),
        );
        setArtistName(
          d.exists()
            ? d.data().name ||
                d.data().displayName ||
                "Unknown Artist"
            : "Unknown Artist",
        );
      } catch (e) {
        console.error("Failed to fetch artist name", e);
        setArtistName("Unknown Artist");
      }
    }

    try {
      await updateDoc(doc(db, "listings", listing.id), {
        views: increment(1),
      });
    } catch (e) {
      console.error("Failed to update view count", e);
    }
  };

  const handleBack = () => {
    setSelectedListing(null);
    setArtistName("");
    isNavigating.current = false;
    router.setParams({ selectedListingId: undefined });
  };

  const pendingSaves = useRef<Set<string>>(new Set());
  const pendingLikes = useRef<Set<string>>(new Set());

  const toggleSave = async (listing: Listing, e?: any) => {
    if (e) e.stopPropagation();
    if (!user || isGuestMode) {
      showGuestAlert(guardedPush, "save artworks");
      return;
    }
    if (pendingSaves.current.has(listing.id)) return;
    pendingSaves.current.add(listing.id);

    const wasSaved = userSaves.has(listing.id);
    setUserSaves((prev) => {
      const next = new Set(prev);
      wasSaved
        ? next.delete(listing.id)
        : next.add(listing.id);
      return next;
    });

    try {
      const saveId = `${user.uid}_${listing.id}`;
      const listingRef = doc(db, "listings", listing.id);
      if (wasSaved) {
        await deleteDoc(doc(db, "saves", saveId));
        await updateDoc(listingRef, {
          saves: increment(-1),
        });
      } else {
        await setDoc(doc(db, "saves", saveId), {
          userId: user.uid,
          listingId: listing.id,
          targetId: listing.id,
          type: "listing",
          createdAt: serverTimestamp(),
        });
        await updateDoc(listingRef, {
          saves: increment(1),
        });
      }
    } catch (e) {
      console.error("Failed to toggle save", e);
      setUserSaves((prev) => {
        const next = new Set(prev);
        wasSaved
          ? next.add(listing.id)
          : next.delete(listing.id);
        return next;
      });
      Alert.alert("Error", "Failed to save item.");
    } finally {
      pendingSaves.current.delete(listing.id);
    }
  };

  const handleToggleLike = async (
    listing: Listing,
    e?: any,
  ) => {
    if (e) e.stopPropagation();
    if (!user || isGuestMode) {
      showGuestAlert(guardedPush, "like artworks");
      return;
    }
    if (pendingLikes.current.has(listing.id)) return;
    pendingLikes.current.add(listing.id);

    const wasLiked = userLikes.has(listing.id);
    setUserLikes((prev) => {
      const next = new Set(prev);
      wasLiked
        ? next.delete(listing.id)
        : next.add(listing.id);
      return next;
    });

    try {
      await toggleLike(
        user.uid,
        listing.id,
        "listing",
        listing.artistId,
      );
    } catch (e) {
      console.error("Failed to toggle like", e);
      setUserLikes((prev) => {
        const next = new Set(prev);
        wasLiked
          ? next.add(listing.id)
          : next.delete(listing.id);
        return next;
      });
    } finally {
      pendingLikes.current.delete(listing.id);
    }
  };

  const handleContact = async () => {
    if (!selectedListing || !user) return;
    if (isGuestMode) {
      setSelectedListing(null);
      showGuestAlert(guardedPush, "contact artists");
      return;
    }
    try {
      const chatsSnap = await getDocs(
        query(
          collection(db, "chats"),
          where(
            "participants",
            "array-contains",
            user.uid,
          ),
        ),
      );
      let existingId: string | null = null;
      for (const cd of chatsSnap.docs) {
        const d = cd.data();
        if (
          d.participants.includes(
            selectedListing.artistId,
          ) &&
          d.listingId === selectedListing.id
        ) {
          existingId = cd.id;
          break;
        }
      }

      const navParams = {
        participantName: artistName,
        listingTitle: selectedListing.title,
        listingId: selectedListing.id,
      };

      if (existingId) {
        guardedPush({
          pathname: "/(app)/chat/detail",
          params: {
            id: existingId,
            ...navParams,
          },
        } as any);
      } else {
        const newChat = await addDoc(
          collection(db, "chats"),
          {
            participants: [
              user.uid,
              selectedListing.artistId,
            ],
            listingId: selectedListing.id,
            listingTitle: selectedListing.title,
            listingImage: selectedListing.imageUrl || "",
            listingPrice: selectedListing.price,
            lastMessage: "",
            lastMessageTime: serverTimestamp(),
            [`unread_${user.uid}`]: false,
            [`unread_${selectedListing.artistId}`]: false,
            createdAt: serverTimestamp(),
            participantNames: {
              [user.uid]:
                userProfile?.displayName ||
                user.displayName ||
                user.email?.split("@")[0] ||
                "User",
              [selectedListing.artistId]: artistName,
            },
            participantEmails: {
              [user.uid]: user.email || "",
              [selectedListing.artistId]:
                selectedListing.artistEmail,
            },
          },
        );
        guardedPush({
          pathname: "/(app)/chat/detail",
          params: {
            id: newChat.id,
            ...navParams,
          },
        } as any);
      }
      setSelectedListing(null);
    } catch (e) {
      console.error("Failed to start chat", e);
      Alert.alert("Error", "Failed to start chat.");
    }
  };

  const handleShare = async () => {
    if (!selectedListing) return;
    try {
      await Share.share({
        message: `Check out this artwork: ${selectedListing.title}`,
        title: selectedListing.title,
      });
      if (user) trackShare(user.uid, selectedListing.id);
    } catch (e) {
      console.error("Failed to share listing", e);
    }
  };

  const filteredListings = useMemo(
    () =>
      listings.filter((l) => {
        const q = searchQuery.toLowerCase().trim();
        if (!q) {
          return (
            selectedCategory === "All" ||
            l.category === selectedCategory
          );
        }
        const matchTitle = l.title
          .toLowerCase()
          .includes(q);
        const matchDesc = l.description
          .toLowerCase()
          .includes(q);
        const matchArtist = (
          artistProfiles[l.artistId]?.displayName || ""
        )
          .toLowerCase()
          .includes(q);
        const matchCategory = l.category
          .toLowerCase()
          .includes(q);
        const matchSearch =
          matchTitle ||
          matchDesc ||
          matchArtist ||
          matchCategory;
        const matchCat =
          selectedCategory === "All" ||
          l.category === selectedCategory;
        return matchSearch && matchCat;
      }),
    [listings, searchQuery, selectedCategory, artistProfiles],
  );

  return (
    <SafeAreaView style={styles.root} edges={isWebsite ? [] : ["top"]}>
      <StatusBar barStyle="dark-content" />
      <View style={isWebsite ? styles.webFrame : styles.phoneFrame}>

      {!isWebsite && <View style={styles.header}>
        <View>
          <Text style={styles.headerSub}>
            Explore & collect
          </Text>
          <Text style={styles.headerTitle}>
            Marketplace
          </Text>
        </View>
        <TouchableOpacity
          style={styles.notifBtn}
          onPress={() => {
            if (isGuestMode) {
              showGuestAlert(
                guardedPush,
                "view notifications",
              );
              return;
            }
            guardedPush("/(app)/notifications");
          }}
        >
          <Ionicons
            name="notifications-outline"
            size={22}
            color={COLORS.text.primary}
          />
          {!isGuestMode && unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {unreadCount > 99
                  ? "99+"
                  : unreadCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>}

      {isWebsite && (
        <View style={styles.webHead}>
          <Text style={styles.headerSub}>Explore & collect</Text>
          <Text style={styles.webTitle}>Marketplace</Text>
        </View>
      )}

      <View style={styles.searchRow}>
        <View style={styles.searchBar}>
          <Ionicons
            name="search-outline"
            size={18}
            color={COLORS.text.secondary}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search artwork…"
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor={COLORS.text.muted}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery("")}
            >
              <Ionicons
                name="close-circle"
                size={16}
                color={COLORS.text.muted}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FilterBar
        categories={CATEGORIES}
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
      />

      <View style={styles.listingLabelRow}>
        <Text style={styles.listingLabel}>Listings</Text>
        {filteredListings.length > 0 && (
          <Text style={styles.listingCount}>
            {filteredListings.length} items
          </Text>
        )}
      </View>

      <ScrollView
        style={styles.gridScroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.gridContent}
      >
        <ListingGrid
          listings={filteredListings}
          loading={loading}
          userSaves={userSaves}
          userLikes={userLikes}
          onListingPress={handleListingPress}
          onToggleSave={toggleSave}
          onToggleLike={handleToggleLike}
          artistProfiles={artistProfiles}
        />
        <View style={{ height: 100 }} />
      </ScrollView>
      </View>

      <ArtworkDetailsModal
        visible={selectedListing !== null}
        listing={selectedListing}
        artistName={artistName}
        isSaved={
          selectedListing
            ? userSaves.has(selectedListing.id)
            : false
        }
        isLiked={
          selectedListing
            ? userLikes.has(selectedListing.id)
            : false
        }
        isGuestMode={isGuestMode}
        onClose={handleBack}
        onShare={handleShare}
        onToggleSave={() =>
          selectedListing && toggleSave(selectedListing)
        }
        onToggleLike={() =>
          selectedListing &&
          handleToggleLike(selectedListing)
        }
        onContactArtist={handleContact}
        onReport={() => {
          if (isGuestMode)
            showGuestAlert(guardedPush, "report content");
        }}
        onArtistPress={
          selectedListing?.artistId &&
          user?.uid !== selectedListing.artistId
            ? () => {
                setSelectedListing(null);
                guardedPush({
                  pathname:
                    "/(app)/artist/artist-profile-view",
                  params: {
                    id: selectedListing.artistId,
                  },
                });
              }
            : undefined
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background.primary,
  },
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
    borderBottomColor: COLORS.border.primary,
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
    backgroundColor: COLORS.text.white,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: COLORS.border.primary,
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
    color: COLORS.text.white,
    fontSize: 9,
    fontWeight: "800",
  },
  searchRow: {
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: COLORS.text.white,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.border.primary,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text.primary,
    paddingVertical: 0,
  },
  listingLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 10,
  },
  listingLabel: {
    fontSize: 17,
    fontWeight: "800",
    color: COLORS.text.primary,
  },
  listingCount: {
    fontSize: 13,
    color: COLORS.text.secondary,
    fontWeight: "500",
  },
  gridScroll: {
    flex: 1,
    width: "100%",
  },
  gridContent: {
    width: "100%",
    paddingHorizontal: 20,
  },
});
