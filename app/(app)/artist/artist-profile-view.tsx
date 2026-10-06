import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
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
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import ReportModal from "../../../components/modals/ReportModal";
import { useAuth } from "../../../contexts/AuthContext";
import { db } from "../../../lib/firebase";
import { getCached, setCache, cacheKey } from "../../../lib/dataCache";
import { notifyNewFollower } from "../../../utils/notifications";

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PADDING = 20;
const GAP = 12;
const ITEM_WIDTH = (SCREEN_WIDTH - PADDING * 2 - GAP) / 2;

interface UserProfile {
  uid: string;
  name?: string;
  bio?: string;
  email: string;
  role: string;
  artistType?: string;
  profileImage?: string;
  verified?: boolean;
  isVerified?: boolean;
}

interface PortfolioItem {
  id: string;
  title: string;
  coverImage: string;
  category: string;
  artistId: string;
}

interface ListingItem {
  id: string;
  title: string;
  imageUrl?: string;
  price: number;
  status: string;
  artistId: string;
}

interface Event {
  id: string;
  title: string;
  location: string;
  eventDate: any;
}

export default function ArtistProfile() {
  const { id } = useLocalSearchParams();
  const { guardedPush, guardedReplace, guardedBack } = useGuardedRouter();
  const { user, isGuestMode } = useAuth();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [portfolios, setPortfolios] = useState<PortfolioItem[]>([]);
  const [listings, setListings] = useState<ListingItem[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'showcase' | 'products' | 'events'>('showcase');
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [messageLoading, setMessageLoading] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);

  // ── Load profile ──
  useEffect(() => {
    if (!id) return;
    const cacheKeyStr = cacheKey('artist_profile', id as string);
    const cached = getCached<UserProfile>(cacheKeyStr);
    if (cached) { setProfile(cached); setLoading(false); return; }
    getDoc(doc(db, 'users', id as string))
      .then((d) => {
        if (d.exists()) {
          const data = d.data() as UserProfile;
          setProfile(data);
          setCache(cacheKeyStr, data);
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  // ── Follow status ──
  useEffect(() => {
    if (!user || !id) return;
    const q = query(
      collection(db, 'following'),
      where('userId', '==', user.uid),
      where('artistId', '==', id),
    );
    return onSnapshot(q, (s) => setIsFollowing(!s.empty));
  }, [user, id]);

  // ── Subscribe to content ──
  useEffect(() => {
    if (!id) return;

    const unsubPortfolios = onSnapshot(
      query(collection(db, 'portfolios'), where('artistId', '==', id)),
      (s) => setPortfolios(s.docs.map((d) => ({ id: d.id, ...d.data() })) as PortfolioItem[]),
    );
    const unsubListings = onSnapshot(
      query(collection(db, 'listings'), where('artistId', '==', id)),
      (s) => setListings(s.docs.map((d) => ({ id: d.id, ...d.data() })) as ListingItem[]),
    );
    const unsubEvents = onSnapshot(
      query(collection(db, 'events'), where('artistId', '==', id)),
      (s) => setEvents(s.docs.map((d) => ({ id: d.id, ...d.data() })) as Event[]),
    );

    return () => { unsubPortfolios(); unsubListings(); unsubEvents(); };
  }, [id]);

  // ── Guest alert ──
  const guestAlert = (action: string) => {
    Alert.alert('Sign In Required', `Please sign in or sign up to ${action}`, [
      { text: 'Sign In', onPress: () => guardedPush('/(auth)/login') },
      { text: 'Sign Up', onPress: () => guardedPush('/(auth)/role-selection') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  // ── Follow / unfollow ──
  const toggleFollow = async () => {
    if (!user || isGuestMode) { guestAlert('follow artists'); return; }
    if (followLoading) return;
    setFollowLoading(true);
    try {
      if (isFollowing) {
        const snap = await getDocs(
          query(
            collection(db, 'following'),
            where('userId', '==', user.uid),
            where('artistId', '==', id),
          ),
        );
        await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
        // Decrement artist's cached followersCount
        try { await updateDoc(doc(db, 'users', id as string), { followersCount: increment(-1) }); } catch {}
      } else {
        await addDoc(collection(db, 'following'), {
          userId: user.uid,
          artistId: id,
          createdAt: serverTimestamp(),
        });
        // Increment artist's cached followersCount
        try { await updateDoc(doc(db, 'users', id as string), { followersCount: increment(1) }); } catch {}
        await notifyNewFollower(
          id as string,
          user.email?.split('@')[0] || 'Someone',
          user.uid,
        );
      }
    } catch {
      Alert.alert('Error', 'Could not update follow status.');
    } finally {
      setFollowLoading(false);
    }
  };

  // ── Message ──
  const handleMessage = async () => {
    if (!user || isGuestMode) { guestAlert('message artists'); return; }
    if (user.uid === id) { Alert.alert('Oops', 'You cannot message yourself.'); return; }
    if (messageLoading) return;
    setMessageLoading(true);
    try {
      const snap = await getDocs(
        query(collection(db, 'chats'), where('participants', 'array-contains', user.uid)),
      );
      let existingChatId = null;
      for (const d of snap.docs) {
        const data = d.data();
        if (data.participants.includes(id) && !data.listingId) {
          existingChatId = d.id;
          break;
        }
      }
      if (existingChatId) {
        guardedPush({
          pathname: '/(app)/chat/detail',
          params: { id: existingChatId, participantName: profile?.name || 'Artist' },
        });
      } else {
        const ref = await addDoc(collection(db, 'chats'), {
          participants: [user.uid, id],
          participantNames: {
            [user.uid]: user.displayName || user.email?.split('@')[0] || 'Me',
            [id as string]: profile?.name || 'Artist',
          },
          participantEmails: {
            [user.uid]: user.email,
            [id as string]: profile?.email || '',
          },
          lastMessage: 'Chat started',
          lastMessageTime: serverTimestamp(),
          createdAt: serverTimestamp(),
          [`unread_${id}`]: true,
          [`unread_${user.uid}`]: false,
        });
        guardedPush({
          pathname: '/(app)/chat/detail',
          params: { id: ref.id, participantName: profile?.name || 'Artist' },
        });
      }
    } catch {
      Alert.alert('Error', 'Could not start chat.');
    } finally {
      setMessageLoading(false);
    }
  };

  // ── Render portfolio item ──
  const renderPortfolioItem = ({ item }: { item: PortfolioItem }) => (
    <TouchableOpacity
      style={styles.gridCard}
      onPress={() =>
        guardedPush({ pathname: '/(app)/showcase/showcase-detail', params: { id: item.id } })
      }
      activeOpacity={0.75}
    >
      <View style={styles.gridImgWrap}>
        {item.coverImage ? (
          <Image source={{ uri: item.coverImage }} style={styles.gridImg} resizeMode="cover" />
        ) : (
          <Feather name="image" size={28} color="#C8BAA8" />
        )}
      </View>
      <Text style={styles.gridTitle} numberOfLines={1}>{item.title}</Text>
      <Text style={styles.gridSub}>{item.category}</Text>
    </TouchableOpacity>
  );

  // ── Render listing item ──
  const renderListingItem = ({ item }: { item: ListingItem }) => (
    <TouchableOpacity
      style={styles.gridCard}
      onPress={() =>
        guardedPush({
          pathname: '/(app)/marketplace/enthusiast-marketplace',
          params: { selectedListingId: item.id },
        })
      }
      activeOpacity={0.75}
    >
      <View style={styles.gridImgWrap}>
        {item.imageUrl ? (
          <Image source={{ uri: item.imageUrl }} style={styles.gridImg} resizeMode="cover" />
        ) : (
          <Feather name="image" size={28} color="#C8BAA8" />
        )}
        {item.status === 'sold' && (
          <View style={styles.soldOverlay}>
            <Text style={styles.soldText}>SOLD</Text>
          </View>
        )}
      </View>
      <Text style={styles.gridTitle} numberOfLines={1}>{item.title}</Text>
      <Text style={[styles.gridPrice, item.status === 'sold' && styles.soldPrice]}>
        ₱{item.price.toLocaleString()}
      </Text>
    </TouchableOpacity>
  );

  // ── Render event item ──
  const renderEventItem = (item: Event) => (
    <TouchableOpacity
      key={item.id}
      style={styles.eventCard}
      onPress={() =>
        guardedPush({ pathname: '/(app)/events/event-detail', params: { id: item.id } })
      }
      activeOpacity={0.75}
    >
      <View style={styles.eventIconBox}>
        <Feather name="calendar" size={20} color="#8B1A1A" />
      </View>
      <View style={styles.eventInfo}>
        <Text style={styles.eventTitle}>{item.title}</Text>
        <Text style={styles.eventLocation}>{item.location}</Text>
      </View>
      <Feather name="chevron-right" size={16} color="#C8BAA8" />
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#8B1A1A" />
        </View>
      </SafeAreaView>
    );
  }

  const isVerified = profile?.verified || profile?.isVerified;
  const initials = (profile?.name || '?').charAt(0).toUpperCase();

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAF7F2" />

      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => guardedBack()} activeOpacity={0.7}>
          <Feather name="arrow-left" size={18} color="#2A1005" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => {
            if (isGuestMode) { guestAlert('report artists'); return; }
            setReportModalVisible(true);
          }}
          activeOpacity={0.7}
        >
          <Feather name="flag" size={16} color="#2A1005" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* Profile header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarWrap}>
            {profile?.profileImage ? (
              <Image
                source={{ uri: profile.profileImage }}
                style={styles.avatar}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
            )}
            {isVerified && (
              <View style={styles.verifiedBadge}>
                <Feather name="check-circle" size={20} color="#8B1A1A" />
              </View>
            )}
          </View>

          <Text style={styles.name}>{profile?.name || 'Unknown Artist'}</Text>
          <Text style={styles.artistType}>
            {profile?.artistType?.toUpperCase() || profile?.role?.toUpperCase() || 'ARTIST'}
          </Text>
          {profile?.bio && <Text style={styles.bio}>{profile.bio}</Text>}

          {/* Action buttons */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionBtn, isFollowing ? styles.actionBtnFilled : styles.actionBtnOutline]}
              onPress={toggleFollow}
              disabled={followLoading}
              activeOpacity={0.8}
            >
              {followLoading ? (
                <ActivityIndicator size="small" color={isFollowing ? '#fff' : '#8B1A1A'} />
              ) : (
                <Text style={[styles.actionBtnText, isFollowing && styles.actionBtnTextFilled]}>
                  {isFollowing ? 'Following' : 'Follow'}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnSecondary]}
              onPress={handleMessage}
              disabled={messageLoading}
              activeOpacity={0.8}
            >
              {messageLoading ? (
                <ActivityIndicator size="small" color="#2A1005" />
              ) : (
                <Text style={styles.actionBtnTextSecondary}>Message</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{portfolios.length}</Text>
            <Text style={styles.statLabel}>Showcase</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{listings.length}</Text>
            <Text style={styles.statLabel}>Products</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{events.length}</Text>
            <Text style={styles.statLabel}>Events</Text>
          </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabsRow}>
          {(['showcase', 'products', 'events'] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab content */}
        <View style={styles.tabContent}>
          {activeTab === 'showcase' && (
            portfolios.length > 0 ? (
              <FlatList
                data={portfolios}
                renderItem={renderPortfolioItem}
                keyExtractor={(i) => i.id}
                numColumns={2}
                scrollEnabled={false}
                columnWrapperStyle={styles.gridRow}
              />
            ) : (
              <View style={styles.emptyState}>
                <Feather name="image" size={40} color="#C8BAA8" />
                <Text style={styles.emptyTitle}>No showcase items yet</Text>
              </View>
            )
          )}
          {activeTab === 'products' && (
            listings.length > 0 ? (
              <FlatList
                data={listings}
                renderItem={renderListingItem}
                keyExtractor={(i) => i.id}
                numColumns={2}
                scrollEnabled={false}
                columnWrapperStyle={styles.gridRow}
              />
            ) : (
              <View style={styles.emptyState}>
                <Feather name="tag" size={40} color="#C8BAA8" />
                <Text style={styles.emptyTitle}>No products for sale</Text>
              </View>
            )
          )}
          {activeTab === 'events' && (
            events.length > 0 ? (
              <View style={styles.eventsList}>
                {events.map(renderEventItem)}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Feather name="calendar" size={40} color="#C8BAA8" />
                <Text style={styles.emptyTitle}>No upcoming events</Text>
              </View>
            )
          )}
        </View>
      </ScrollView>

      <ReportModal
        visible={reportModalVisible}
        onClose={() => setReportModalVisible(false)}
        targetId={id as string}
        targetType="artist"
        reportedBy={user?.uid || ''}
        targetTitle={profile?.name || 'Artist'}
        targetImage={profile?.profileImage || ''}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FAF7F2',
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingBottom: 48,
  },

  // Top bar
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: '#EDE0D4',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Profile header
  profileHeader: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 28,
  },
  avatarWrap: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    borderColor: '#EDE0D4',
  },
  avatarFallback: {
    backgroundColor: '#8B1A1A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 38,
    fontWeight: '800',
    color: '#fff',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  name: {
    fontSize: 22,
    fontWeight: '800',
    color: '#2A1005',
    marginBottom: 4,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  artistType: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8B1A1A',
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  bio: {
    fontSize: 14,
    color: '#6B5946',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 24,
    fontStyle: 'italic',
    maxWidth: '88%',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnOutline: {
    borderWidth: 1.5,
    borderColor: '#8B1A1A',
    backgroundColor: '#fff',
  },
  actionBtnFilled: {
    backgroundColor: '#8B1A1A',
  },
  actionBtnSecondary: {
    backgroundColor: '#F5F1E8',
    borderWidth: 1,
    borderColor: '#EDE0D4',
  },
  actionBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#8B1A1A',
  },
  actionBtnTextFilled: {
    color: '#fff',
  },
  actionBtnTextSecondary: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2A1005',
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EDE0D4',
    paddingVertical: 16,
    marginBottom: 8,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#2A1005',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    color: '#9B8265',
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#EDE0D4',
  },

  // Tabs
  tabsRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#EDE0D4',
    marginTop: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#8B1A1A',
  },
  tabText: {
    fontSize: 13,
    color: '#9B8265',
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#8B1A1A',
    fontWeight: '700',
  },
  tabContent: {
    padding: PADDING,
    minHeight: 160,
  },

  // Grid
  gridRow: {
    justifyContent: 'space-between',
    marginBottom: GAP,
  },
  gridCard: {
    width: ITEM_WIDTH,
    marginBottom: 4,
  },
  gridImgWrap: {
    width: '100%',
    height: ITEM_WIDTH,
    backgroundColor: '#F5F1E8',
    borderRadius: 14,
    marginBottom: 8,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#EDE0D4',
  },
  gridImg: {
    width: '100%',
    height: '100%',
  },
  gridTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2A1005',
    marginBottom: 2,
  },
  gridSub: {
    fontSize: 12,
    color: '#9B8265',
  },
  gridPrice: {
    fontSize: 13,
    color: '#8B1A1A',
    fontWeight: '700',
    marginTop: 2,
  },
  soldPrice: {
    textDecorationLine: 'line-through',
    opacity: 0.5,
    color: '#9B8265',
  },
  soldOverlay: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  soldText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
    transform: [{ rotate: '-15deg' }],
  },

  // Events
  eventsList: {
    gap: 12,
  },
  eventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EDE0D4',
  },
  eventIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FDF5F2',
    borderWidth: 1,
    borderColor: '#F0DDD8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventInfo: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2A1005',
    marginBottom: 2,
  },
  eventLocation: {
    fontSize: 13,
    color: '#9B8265',
  },

  // Empty
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2A1005',
  },
});
