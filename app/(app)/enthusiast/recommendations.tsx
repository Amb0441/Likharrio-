import { Feather, Ionicons } from "@expo/vector-icons";
import { useGuardedRouter } from "../../../utils/navigationGuard";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { db } from "../../../lib/firebase";
import { fetchOnce, getCached, cacheKey } from "../../../lib/dataCache";
import COLORS from "../../../constants/Colors";
import { useAuth } from "../../../contexts/AuthContext";
import {
  getRecommendedArtworks,
  RecommendedArtwork,
  trackView,
} from "../../../utils/recommendations/recommendationEngine";
import ArtworkDetailsModal from "../../../components/modals/ArtworkDetailsModal";
import type { Listing } from "../../../lib/types";
import ReportModal from "../../../components/modals/ReportModal";

// ── Reason icon helper ──
function reasonIcon(reason: string): React.ComponentProps<typeof Ionicons>['name'] {
  if (reason.includes('interest')) return 'sparkles';
  if (reason.includes('love') || reason.includes('artist')) return 'heart';
  if (reason.includes('enjoy') || reason.includes('category')) return 'color-palette';
  if (reason.includes('Trending') || reason.includes('Most')) return 'flame';
  if (reason.includes('enthusiast') || reason.includes('Similar')) return 'people';
  return 'trending-up';
}

export default function RecommendationsScreen() {
  const { user } = useAuth();
  const { guardedPush, guardedBack } = useGuardedRouter();
  const isNavigating = useRef(false);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [artworks, setArtworks] = useState<RecommendedArtwork[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [selectedArtistName, setSelectedArtistName] = useState('');
  const [isSaved, setIsSaved] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportTargetId, setReportTargetId] = useState('');
  const [reportTargetTitle, setReportTargetTitle] = useState('');
  const [reportTargetType, setReportTargetType] = useState<'listing' | 'artist' | 'artwork'>('listing');

  useEffect(() => {
    if (user) loadRecommendations();
  }, [user]);

  // ── Load recommendations ──
  const loadRecommendations = async () => {
    if (!user) return;
    try {
      const key = cacheKey('recs', user.uid);
      const cached = getCached<RecommendedArtwork[]>(key);
      if (cached) {
        setArtworks(cached);
        setLoading(false);
        return;
      }
      setLoading(true);
      const artworkRecs = await fetchOnce(key, () => getRecommendedArtworks(user.uid, 20));
      setArtworks(artworkRecs);
    } catch (error) {
      console.error('Error loading recommendations:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadRecommendations();
  };

  // ── Open artwork ──
  const handleArtworkPress = async (artwork: RecommendedArtwork) => {
    if (isNavigating.current) return;
    isNavigating.current = true;

    if (user) trackView(user.uid, artwork.id);

    if (artwork.type === 'portfolio') {
      guardedPush({
        pathname: '/(app)/showcase/showcase-detail',
        params: { id: artwork.id },
      });
      setTimeout(() => { isNavigating.current = false; }, 800);
      return;
    }

    try {
      const docSnap = await getDoc(doc(db, 'listings', artwork.id));
      if (docSnap.exists()) {
        const fullListing = { id: docSnap.id, ...docSnap.data() } as Listing;
        setSelectedListing(fullListing);
        setSelectedArtistName(artwork.artistName);
        setModalVisible(true);
      }
    } catch (error) {
      console.error('Error fetching listing details:', error);
    }
    setTimeout(() => { isNavigating.current = false; }, 800);
  };

  // ── Share ──
  const handleShare = async () => {
    if (!selectedListing) return;
    try {
      await Share.share({
        message: `Check out this artwork: ${selectedListing.title} — ₱${selectedListing.price.toLocaleString()}`,
        title: selectedListing.title,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  // ── Contact artist ──
  const handleContactArtist = async () => {
    if (!selectedListing || !user) return;
    setModalVisible(false);

    try {
      const chatsSnapshot = await getDocs(
        query(collection(db, 'chats'), where('participants', 'array-contains', user.uid)),
      );
      let existingChatId: string | null = null;

      for (const chatDoc of chatsSnapshot.docs) {
        const chatData = chatDoc.data();
        if (
          chatData.participants.includes(selectedListing.artistId) &&
          chatData.listingId === selectedListing.id
        ) {
          existingChatId = chatDoc.id;
          break;
        }
      }

      const params = {
        participantName: selectedArtistName,
        listingTitle: selectedListing.title,
        listingId: selectedListing.id,
      };

      if (existingChatId) {
        guardedPush({ pathname: '/(app)/chat/detail', params: { id: existingChatId, ...params } } as any);
      } else {
        const newChat = await addDoc(collection(db, 'chats'), {
          participants: [user.uid, selectedListing.artistId],
          listingId: selectedListing.id,
          listingTitle: selectedListing.title,
          listingImage: selectedListing.imageUrl || '',
          listingPrice: selectedListing.price,
          lastMessage: '',
          lastMessageTime: serverTimestamp(),
          [`unread_${user.uid}`]: false,
          [`unread_${selectedListing.artistId}`]: false,
          createdAt: serverTimestamp(),
          participantNames: {
            [user.uid]: user.email?.split('@')[0] || 'User',
            [selectedListing.artistId]: selectedArtistName,
          },
          participantEmails: {
            [user.uid]: user.email || '',
            [selectedListing.artistId]: selectedListing.artistEmail,
          },
        });
        guardedPush({ pathname: '/(app)/chat/detail', params: { id: newChat.id, ...params } } as any);
      }
    } catch (e) {
      console.error('Error starting chat', e);
    }
  };

  // ── Render artwork card ──
  const renderArtworkCard = (artwork: RecommendedArtwork) => (
    <TouchableOpacity
      key={artwork.id}
      style={styles.artworkCard}
      onPress={() => handleArtworkPress(artwork)}
      activeOpacity={0.85}
      onLongPress={() => {
        setReportTargetId(artwork.id);
        setReportTargetTitle(artwork.title);
        setReportTargetType(artwork.type === 'listing' ? 'listing' : 'artwork');
        setReportModalVisible(true);
      }}
    >
      <Image
        source={{ uri: artwork.imageUrl || 'https://via.placeholder.com/400x300' }}
        style={styles.artworkImage}
      />

      {/* Type badge */}
      <View style={[styles.typeBadge, artwork.type === 'listing' ? styles.typeListing : styles.typePortfolio]}>
        <Text style={styles.typeBadgeText}>
          {artwork.type === 'listing' ? 'For Sale' : 'Showcase'}
        </Text>
      </View>

      {/* Price badge */}
      {artwork.price ? (
        <View style={styles.priceBadge}>
          <Text style={styles.priceBadgeText}>₱{artwork.price.toLocaleString()}</Text>
        </View>
      ) : null}

      <View style={styles.artworkInfo}>
        <Text style={styles.artworkTitle} numberOfLines={1}>{artwork.title}</Text>
        <Text style={styles.artworkArtist} numberOfLines={1}>by {artwork.artistName}</Text>

        <View style={styles.artworkStats}>
          <View style={styles.statItem}>
            <Ionicons name="heart" size={13} color={COLORS.primary.deepRed} />
            <Text style={styles.statText}>{artwork.likes}</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="eye" size={13} color={COLORS.text.muted} />
            <Text style={styles.statText}>{artwork.views}</Text>
          </View>
        </View>

        <View style={styles.reasonBadge}>
          <Ionicons name={reasonIcon(artwork.reason)} size={11} color={COLORS.primary.deepRed} />
          <Text style={styles.reasonText} numberOfLines={1}>{artwork.reason}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  // ── Loading state ──
  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => guardedBack()} style={styles.backButton}>
            <Feather name="arrow-left" size={18} color="#2A1005" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>For You</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary.deepRed} />
          <Text style={styles.loadingText}>Curating your feed…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => guardedBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={18} color="#2A1005" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Ionicons name="sparkles" size={18} color={COLORS.primary.deepRed} />
          <Text style={styles.headerTitle}>For You</Text>
        </View>
        <TouchableOpacity onPress={onRefresh} style={styles.refreshButton}>
          <Feather name="refresh-cw" size={18} color={COLORS.primary.deepRed} />
        </TouchableOpacity>
      </View>

      {/* Subtitle */}
      <View style={styles.subtitleBar}>
        <Text style={styles.subtitleText}>
          {artworks.length > 0
            ? `${artworks.length} artworks picked just for you`
            : 'Start exploring to personalise this feed'}
        </Text>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary.deepRed}
          />
        }
      >
        {artworks.length > 0 ? (
          <View style={styles.grid}>
            {artworks.map(renderArtworkCard)}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="heart-outline" size={48} color={COLORS.primary.deepRed} />
            </View>
            <Text style={styles.emptyTitle}>No Recommendations Yet</Text>
            <Text style={styles.emptyText}>
              Like, save, or view artworks and we'll start personalising your feed.
            </Text>
            <TouchableOpacity
              style={styles.exploreButton}
              onPress={() => guardedPush('/(app)/marketplace/enthusiast-marketplace')}
            >
              <Text style={styles.exploreButtonText}>Explore Showcase</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <ArtworkDetailsModal
        visible={modalVisible}
        listing={selectedListing}
        artistName={selectedArtistName}
        isSaved={isSaved}
        onClose={() => setModalVisible(false)}
        onShare={handleShare}
        onToggleSave={() => setIsSaved(!isSaved)}
        onContactArtist={handleContactArtist}
        onReport={() => {
          if (selectedListing) {
            setReportTargetId(selectedListing.id);
            setReportTargetTitle(selectedListing.title);
            setReportTargetType('listing');
            setReportModalVisible(true);
          }
        }}
      />

      <ReportModal
        visible={reportModalVisible}
        onClose={() => setReportModalVisible(false)}
        targetId={reportTargetId}
        targetType={reportTargetType}
        reportedBy={user?.uid || ''}
        targetTitle={reportTargetTitle}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background.primary,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.light,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#EDE0D4',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text.primary,
  },
  headerSpacer: {
    width: 36,
  },
  refreshButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#EDE0D4',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Subtitle
  subtitleBar: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: COLORS.background.secondary,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.light,
  },
  subtitleText: {
    fontSize: 13,
    color: COLORS.text.secondary,
    fontStyle: 'italic',
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 15,
    color: COLORS.text.secondary,
  },

  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },

  // Grid
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 14,
    gap: 14,
  },

  // Artwork card
  artworkCard: {
    width: '47%',
    backgroundColor: '#fff',
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  artworkImage: {
    width: '100%',
    height: 155,
    backgroundColor: COLORS.background.secondary,
  },
  typeBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  typeListing: {
    backgroundColor: COLORS.primary.deepRed,
  },
  typePortfolio: {
    backgroundColor: COLORS.primary.forestGreen,
  },
  typeBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  priceBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.72)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  priceBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  artworkInfo: {
    padding: 11,
  },
  artworkTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text.primary,
    marginBottom: 3,
  },
  artworkArtist: {
    fontSize: 11,
    color: COLORS.text.secondary,
    marginBottom: 8,
  },
  artworkStats: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 11,
    color: COLORS.text.muted,
  },
  reasonBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF0F0',
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 6,
  },
  reasonText: {
    fontSize: 10,
    color: COLORS.primary.deepRed,
    fontWeight: '600',
    flex: 1,
  },

  // Empty state
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyIconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#FFF0F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text.primary,
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  exploreButton: {
    backgroundColor: COLORS.primary.deepRed,
    paddingHorizontal: 28,
    paddingVertical: 13,
    borderRadius: 12,
  },
  exploreButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});
