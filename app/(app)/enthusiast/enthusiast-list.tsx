import { Feather } from "@expo/vector-icons";
import {
  collection,
  doc,
  getDoc,
  increment,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useGuardedRouter } from "../../../utils/navigationGuard";
import {
  ActivityIndicator,
  Alert,
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
import { useAuth } from "../../../contexts/AuthContext";
import { useLayoutMode } from "../../../hooks/useLayoutMode";
import { db } from "../../../lib/firebase";
import { getCached, setCache, cacheKey } from "../../../lib/dataCache";

const CATEGORIES = ['All', 'Painting', 'Drawing & Illustration', 'Weaving & Textiles', 'Wood Craft', 'Sculpture', 'Other'];

const CATEGORY_LABEL_MAP: Record<string, string> = {
  'painting': 'Painting',
  'drawing-illustration': 'Drawing & Illustration',
  'drawing': 'Drawing & Illustration',
  'drawing & illustration': 'Drawing & Illustration',
  'weaving-textiles': 'Weaving & Textiles',
  'weaving': 'Weaving & Textiles',
  'weaving & textiles': 'Weaving & Textiles',
  'wood-craft': 'Wood Craft',
  'wood craft': 'Wood Craft',
  'sculpture': 'Sculpture',
  'other': 'Other',
};

interface Artwork {
  id: string;
  title: string;
  artistName: string;
  artistId: string;
  artistColor: string;
  artistImage?: string;
  likes: number;
  views: number;
  category: string;
  image: string;
}

export default function EnthusiastList() {
  const { user, isGuestMode } = useAuth();
  const { isWebsite, width } = useLayoutMode();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [artworks, setArtworks] = useState<Artwork[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLikes, setUserLikes] = useState<Set<string>>(new Set());
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [submittingLikes, setSubmittingLikes] = useState<Set<string>>(new Set());
  const { guardedPush, guardedReplace } = useGuardedRouter();
  const artistCacheRef = useRef<Record<string, { name: string; image: string | null }>>({});

  // ── Subscribe to artworks ──
  useEffect(() => {
    // Show cached data instantly to skip loading flash on re-mount
    const cacheKeyStr = cacheKey('discover_feed');
    const cached = getCached<Artwork[]>(cacheKeyStr);
    if (cached) {
      setArtworks(cached);
      setLoading(false);
    }

    const q = query(collection(db, 'portfolios'), orderBy('createdAt', 'desc'));

    const unsubArtworks = onSnapshot(q, async (snapshot) => {
      const getColor = (str: string) => {
        const colors = ['#E91E63', '#9C27B0', '#3F51B5', '#009688', '#FF5722'];
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
          hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        return colors[Math.abs(hash) % colors.length];
      };

      const formatCategory = (catId: string) => {
        if (!catId) return 'Other';
        const lower = catId.toLowerCase();
        return CATEGORY_LABEL_MAP[lower] || catId.charAt(0).toUpperCase() + catId.slice(1);
      };

      const fetched: Artwork[] = snapshot.docs.map((d) => ({
        id: d.id,
        title: d.data().title || 'Untitled',
        artistName: 'Loading…',
        artistId: d.data().artistId || '',
        artistColor: getColor(d.data().artistId || 'anon'),
        likes: d.data().likes || 0,
        views: d.data().views || 0,
        category: formatCategory(d.data().category),
        image: d.data().coverImage,
      }));

      // Only fetch artist names NOT already in cache
      const uniqueIds = [...new Set(fetched.map((a) => a.artistId).filter(Boolean))];
      const uncachedIds = uniqueIds.filter((id) => !artistCacheRef.current[id]);

      if (uncachedIds.length > 0) {
        const newEntries: Record<string, { name: string; image: string | null }> = {};
        await Promise.all(
          uncachedIds.map(async (id: string) => {
            try {
              const d = await getDoc(doc(db, 'users', id));
              if (d.exists()) {
                const data = d.data();
                newEntries[id] = {
                  name: data.name || data.username || data.displayName || 'Unknown Artist',
                  image: data.profileImage || null,
                };
              }
            } catch {}
          }),
        );
        Object.assign(artistCacheRef.current, newEntries);
      }

      const enriched = fetched.map((a) => {
        const cached = artistCacheRef.current[a.artistId];
        return {
          ...a,
          artistName: cached?.name || 'Unknown Artist',
          artistImage: cached?.image || undefined,
        };
      });

      setArtworks((prev) =>
        submittingLikes.size === 0
          ? enriched
          : enriched.map((a) => {
              if (submittingLikes.has(a.id)) {
                const p = prev.find((x) => x.id === a.id);
                return p ? { ...a, likes: p.likes } : a;
              }
              return a;
            }),
      );
      setCache(cacheKey('discover_feed'), enriched);
      setLoading(false);
    });

    // Subscribe to user likes
    let unsubLikes = () => {};
    if (user) {
      unsubLikes = onSnapshot(
        query(collection(db, 'likes'), where('userId', '==', user.uid)),
        (snap) => {
          const ids = new Set(snap.docs.map((d) => d.data().targetId));
          if (submittingLikes.size === 0) setUserLikes(ids);
        },
      );
    }

    return () => {
      unsubArtworks();
      unsubLikes();
    };
  }, [user, submittingLikes]);

  // ── Like / unlike ──
  const handleLike = async (artwork: Artwork) => {
    if (!user || isGuestMode) {
      Alert.alert('Sign In Required', 'Please sign in or sign up to like artworks', [
        { text: 'Sign In', onPress: () => guardedPush('/(auth)/login') },
        { text: 'Sign Up', onPress: () => guardedPush('/(auth)/role-selection') },
        { text: 'Cancel', style: 'cancel' },
      ]);
      return;
    }
    if (submittingLikes.has(artwork.id)) return;

    setSubmittingLikes((prev) => new Set(prev).add(artwork.id));
    const wasLiked = userLikes.has(artwork.id);

    try {
      await runTransaction(db, async (tx) => {
        const pRef = doc(db, 'portfolios', artwork.id);
        const lRef = doc(db, 'likes', `${user.uid}_${artwork.id}`);
        const artistRef = doc(db, 'users', artwork.artistId);
        const [pDoc, lDoc] = await Promise.all([tx.get(pRef), tx.get(lRef)]);
        if (!pDoc.exists()) throw 'Portfolio does not exist!';
        if (lDoc.exists()) {
          tx.delete(lRef);
          tx.update(pRef, { likes: increment(-1) });
          tx.set(artistRef, { likesCount: increment(-1) }, { merge: true });
        } else {
          tx.set(lRef, {
            userId: user.uid,
            targetId: artwork.id,
            type: 'portfolio',
            createdAt: serverTimestamp(),
          });
          tx.update(pRef, { likes: increment(1) });
          tx.set(artistRef, { likesCount: increment(1) }, { merge: true });
        }
      });
      await new Promise((r) => setTimeout(r, 200));
    } catch {
      setUserLikes((prev) => {
        const s = new Set(prev);
        if (wasLiked) s.add(artwork.id);
        else s.delete(artwork.id);
        return s;
      });
      setArtworks((prev) =>
        prev.map((i) =>
          i.id === artwork.id
            ? { ...i, likes: Math.max(0, wasLiked ? i.likes + 1 : i.likes - 1) }
            : i,
        ),
      );
    } finally {
      setSubmittingLikes((prev) => {
        const s = new Set(prev);
        s.delete(artwork.id);
        return s;
      });
    }
  };

  // ── Navigate to detail + record view ──
  const handleNavigate = (id: string) => {
    if (user) {
      setDoc(doc(db, 'views', `${user.uid}_${id}`), {
        userId: user.uid,
        targetId: id,
        type: 'portfolio',
        viewedAt: serverTimestamp(),
      }).catch(() => {});
    }
    guardedPush({ pathname: '/(app)/showcase/showcase-detail', params: { id } });
  };

  // ── Filter artworks ──
  const filtered = useMemo(
    () =>
      artworks.filter((a) => {
        const q = searchQuery.toLowerCase();
        const matchSearch =
          !q ||
          a.title.toLowerCase().includes(q) ||
          a.artistName.toLowerCase().includes(q);
        const matchCat =
          selectedCategory === 'All' ||
          a.category.toLowerCase() === selectedCategory.toLowerCase();
        return matchSearch && matchCat;
      }),
    [artworks, searchQuery, selectedCategory],
  );

  const columns = !isWebsite ? 1 : width >= 1100 ? 3 : 2;

  return (
    <SafeAreaView style={styles.root} edges={isWebsite ? [] : ['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAF7F2" />

      {!isWebsite && (
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Discover</Text>
        </View>
      )}

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={true}
        contentContainerStyle={isWebsite ? styles.webPage : undefined}
      >
        {isWebsite && <Text style={styles.webTitle}>Discover</Text>}

        {/* Search + Filter */}
        <View style={styles.searchRow}>
          <View style={styles.searchBar}>
            <Feather name="search" size={16} color="#9B8265" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search artworks or artists…"
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor="#C4AFA5"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Feather name="x-circle" size={15} color="#C4AFA5" />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            style={styles.filterBtn}
            onPress={() => setShowCategoryModal(true)}
            activeOpacity={0.75}
          >
            <Feather name="sliders" size={16} color="#8B1A1A" />
          </TouchableOpacity>
        </View>

        {/* Category chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
        >
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[styles.chip, selectedCategory === cat && styles.chipActive]}
              onPress={() => setSelectedCategory(cat)}
              activeOpacity={0.75}
            >
              <Text style={[styles.chipText, selectedCategory === cat && styles.chipTextActive]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Content */}
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color="#8B1A1A" />
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIconCircle}>
              <Feather name="image" size={36} color="#C8BAA8" />
            </View>
            <Text style={styles.emptyTitle}>No artwork found</Text>
            <Text style={styles.emptySub}>Try a different search or category</Text>
          </View>
        ) : (
          <View style={[styles.artworkList, isWebsite && styles.artworkGrid]}>
            {filtered.map((artwork) => (
              <View key={artwork.id} style={isWebsite ? { width: `${100 / columns}%`, padding: 8 } : undefined}>
                <ArtworkCard
                  artwork={artwork}
                  isLiked={userLikes.has(artwork.id)}
                  isSubmitting={submittingLikes.has(artwork.id)}
                  onLike={handleLike}
                  onNavigate={handleNavigate}
                />
              </View>
            ))}
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Category modal */}
      <Modal
        visible={showCategoryModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCategoryModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowCategoryModal(false)}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter by Category</Text>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setShowCategoryModal(false)}
              >
                <Feather name="x" size={16} color="#2A1005" />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.modalOption, selectedCategory === cat && styles.modalOptionActive]}
                  onPress={() => { setSelectedCategory(cat); setShowCategoryModal(false); }}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.modalOptionText, selectedCategory === cat && styles.modalOptionTextActive]}>
                    {cat}
                  </Text>
                  {selectedCategory === cat && <Feather name="check" size={16} color="#8B1A1A" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

// ── Memoized artwork card ──
const ArtworkCard = React.memo(function ArtworkCard({
  artwork,
  isLiked,
  isSubmitting,
  onLike,
  onNavigate,
}: {
  artwork: Artwork;
  isLiked: boolean;
  isSubmitting: boolean;
  onLike: (artwork: Artwork) => void;
  onNavigate: (id: string) => void;
}) {
  return (
    <TouchableOpacity
      style={styles.artworkCard}
      onPress={() => onNavigate(artwork.id)}
      activeOpacity={0.9}
    >
      <Image
        source={{ uri: artwork.image }}
        style={styles.artworkImage}
        resizeMode="cover"
      />

      <View style={styles.categoryBadge}>
        <Text style={styles.categoryBadgeText}>{artwork.category}</Text>
      </View>

      <View style={styles.artworkBody}>
        <Text style={styles.artworkTitle} numberOfLines={1}>
          {artwork.title}
        </Text>

        <View style={styles.artistRow}>
          {artwork.artistImage ? (
            <Image
              source={{ uri: artwork.artistImage }}
              style={styles.artistAvatar}
              resizeMode="cover"
            />
          ) : (
            <View
              style={[
                styles.artistAvatar,
                { backgroundColor: artwork.artistColor, justifyContent: 'center', alignItems: 'center' },
              ]}
            >
              <Text style={styles.artistAvatarText}>
                {(artwork.artistName || '?').charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <Text style={styles.artistName} numberOfLines={1}>
            {artwork.artistName}
          </Text>
        </View>

        <View style={styles.bottomRow}>
          <View style={styles.statsGroup}>
            <View style={styles.stat}>
              <Feather name="heart" size={13} color="#9B8265" />
              <Text style={styles.statText}>{Math.max(0, artwork.likes)}</Text>
            </View>
            <View style={styles.stat}>
              <Feather name="eye" size={13} color="#9B8265" />
              <Text style={styles.statText}>{artwork.views}</Text>
            </View>
          </View>

          <View style={styles.actionsGroup}>
            <TouchableOpacity
              style={[
                styles.likeBtn,
                isLiked && styles.likeBtnActive,
                isSubmitting && styles.likeBtnSubmitting,
              ]}
              onPress={() => onLike(artwork)}
              disabled={isSubmitting}
              activeOpacity={0.75}
            >
              <Feather name="heart" size={14} color={isLiked ? '#fff' : '#8B1A1A'} />
              <Text style={[styles.likeBtnText, isLiked && styles.likeBtnTextActive]}>
                {isLiked ? 'Liked' : 'Like'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.viewBtn}
              onPress={() => onNavigate(artwork.id)}
              activeOpacity={0.8}
            >
              <Text style={styles.viewBtnText}>View</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}, (prev, next) =>
  prev.artwork.id === next.artwork.id &&
  prev.artwork.title === next.artwork.title &&
  prev.artwork.image === next.artwork.image &&
  prev.artwork.likes === next.artwork.likes &&
  prev.artwork.views === next.artwork.views &&
  prev.artwork.artistName === next.artwork.artistName &&
  prev.artwork.artistImage === next.artwork.artistImage &&
  prev.artwork.category === next.artwork.category &&
  prev.isLiked === next.isLiked &&
  prev.isSubmitting === next.isSubmitting
);

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FAF7F2',
  },
  scroll: {
    flex: 1,
  },

  // Header
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EDE0D4',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#2A1005',
    letterSpacing: -0.5,
  },
  webPage: {
    width: '100%',
    maxWidth: 1180,
    alignSelf: 'center',
    paddingHorizontal: 8,
    paddingBottom: 40,
  },
  webTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#2A1005',
    letterSpacing: -0.6,
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 4,
  },
  artworkGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    gap: 0,
  },

  // Search
  searchRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 10,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#EDE0D4',
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#2A1005',
    paddingVertical: 0,
  },
  filterBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#FDF5F2',
    borderWidth: 1,
    borderColor: '#F0DDD8',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Chips
  chipsRow: {
    paddingHorizontal: 20,
    gap: 8,
    paddingBottom: 12,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#EDE0D4',
  },
  chipActive: {
    backgroundColor: '#8B1A1A',
    borderColor: '#8B1A1A',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9B8265',
  },
  chipTextActive: {
    color: '#fff',
    fontWeight: '700',
  },

  // Loading / Empty
  loadingWrap: {
    padding: 60,
    alignItems: 'center',
  },
  emptyWrap: {
    alignItems: 'center',
    marginTop: 60,
    gap: 10,
  },
  emptyIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#F5F1E8',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2A1005',
  },
  emptySub: {
    fontSize: 13,
    color: '#9B8265',
  },

  // Artwork list
  artworkList: {
    paddingHorizontal: 20,
    gap: 16,
  },
  artworkCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#EDE0D4',
    shadowColor: '#2A1005',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  artworkImage: {
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: '#F5F1E8',
  },
  categoryBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(42,16,5,0.65)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  categoryBadgeText: {
    color: '#FAF3E8',
    fontSize: 11,
    fontWeight: '600',
  },
  artworkBody: {
    padding: 16,
    gap: 10,
  },
  artworkTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#2A1005',
    letterSpacing: -0.2,
  },
  artistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  artistAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    overflow: 'hidden',
  },
  artistAvatarText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  artistName: {
    fontSize: 13,
    color: '#6B5946',
    fontWeight: '500',
    flex: 1,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statsGroup: {
    flexDirection: 'row',
    gap: 14,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 13,
    color: '#9B8265',
    fontWeight: '500',
  },
  actionsGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  likeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#8B1A1A',
    backgroundColor: '#fff',
  },
  likeBtnActive: {
    backgroundColor: '#8B1A1A',
  },
  likeBtnSubmitting: {
    opacity: 0.6,
  },
  likeBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8B1A1A',
  },
  likeBtnTextActive: {
    color: '#fff',
  },
  viewBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#8B1A1A',
  },
  viewBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },

  // Category modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FAF7F2',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
  },
  modalHandle: {
    width: 36,
    height: 4,
    backgroundColor: '#EDE0D4',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#EDE0D4',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#2A1005',
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EDE0D4',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EDE0D4',
  },
  modalOptionActive: {
    backgroundColor: '#FDF5F2',
  },
  modalOptionText: {
    fontSize: 15,
    color: '#2A1005',
  },
  modalOptionTextActive: {
    fontWeight: '700',
    color: '#8B1A1A',
  },

  bottomSpacer: {
    height: 32,
  },
});
