import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  collection,
  DocumentData,
  getDocs,
  limit,
  orderBy,
  query,
  QueryDocumentSnapshot,
  startAfter,
  where,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { db } from "../../../lib/firebase";
import { getCached, setCache, cacheKey, clearCache } from "../../../lib/dataCache";

interface Artist {
  id: string;
  displayName: string;
  role: string;
  email: string;
  profileImage?: string;
}

const PAGE_SIZE = 15;

export default function ArtistsAll() {
  const router = useRouter();

  const [artists, setArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [allLoaded, setAllLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // ── Fetch artists ──
  const fetchArtists = async (loadMore = false) => {
    if (loadMore && (isFetchingMore || allLoaded)) return;

    if (loadMore) {
      setIsFetchingMore(true);
    } else {
      setLoading(true);
    }

    try {
      const q = loadMore && lastVisible
        ? query(
            collection(db, 'users'),
            where('role', '==', 'artist'),
            orderBy('displayName', 'asc'),
            startAfter(lastVisible),
            limit(PAGE_SIZE),
          )
        : query(
            collection(db, 'users'),
            where('role', '==', 'artist'),
            orderBy('displayName', 'asc'),
            limit(PAGE_SIZE),
          );

      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const newArtists = snapshot.docs.map((doc) => ({
          id: doc.id,
          displayName: doc.data().displayName || doc.data().name || 'Unknown Artist',
          role: doc.data().artistType || 'Artist',
          email: "",
          profileImage: doc.data().profileImage || null,
        })) as Artist[];

        setArtists((prev) => loadMore ? [...prev, ...newArtists] : newArtists);
        if (!loadMore) setCache(cacheKey('all_artists'), { artists: newArtists, lastVisible: snapshot.docs[snapshot.docs.length - 1], allLoaded: false });
        setLastVisible(snapshot.docs[snapshot.docs.length - 1]);

        if (snapshot.docs.length < PAGE_SIZE) {
          setAllLoaded(true);
        }
      } else {
        setAllLoaded(true);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setIsFetchingMore(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const key = cacheKey('all_artists');
    const cached = getCached<{ artists: Artist[]; lastVisible: any; allLoaded: boolean }>(key);
    if (cached) {
      setArtists(cached.artists);
      setLastVisible(cached.lastVisible);
      setAllLoaded(cached.allLoaded);
      setLoading(false);
      return;
    }
    fetchArtists();
  }, []);

  // ── Pull to refresh ──
  const onRefresh = () => {
    clearCache(cacheKey('all_artists'));
    setRefreshing(true);
    setAllLoaded(false);
    setLastVisible(null);
    fetchArtists(false);
  };

  // ── Render artist card ──
  const renderItem = ({ item }: { item: Artist }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() =>
        router.push({
          pathname: '/(app)/artist/artist-profile-view',
          params: { id: item.id },
        })
      }
      activeOpacity={0.75}
    >
      {item.profileImage ? (
        <Image
          source={{ uri: item.profileImage }}
          style={styles.avatar}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.avatar, styles.avatarFallback]}>
          <Text style={styles.avatarText}>
            {(item.displayName || '?').charAt(0).toUpperCase()}
          </Text>
        </View>
      )}

      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {item.displayName}
        </Text>
        <Text style={styles.role} numberOfLines={1}>
          {item.role}
        </Text>
      </View>

      <View style={styles.chevronBox}>
        <Feather name="chevron-right" size={16} color="#8B1A1A" />
      </View>
    </TouchableOpacity>
  );

  // ── Footer ──
  const renderFooter = () => {
    if (isFetchingMore) {
      return (
        <View style={styles.footerLoader}>
          <ActivityIndicator size="small" color="#8B1A1A" />
        </View>
      );
    }
    return <View style={styles.footerSpacer} />;
  };

  // ── Empty state ──
  const renderEmpty = () => (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyIconCircle}>
        <Feather name="users" size={36} color="#C8BAA8" />
      </View>
      <Text style={styles.emptyTitle}>No artists yet</Text>
      <Text style={styles.emptySub}>Check back later for new artists</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAF7F2" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.replace('/(app)/enthusiast/enthusiast-home')}
          activeOpacity={0.7}
        >
          <Feather name="arrow-left" size={18} color="#2A1005" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>All Artists</Text>

        <View style={styles.headerSpacer} />
      </View>

      {/* Content */}
      {loading && !refreshing ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#8B1A1A" />
        </View>
      ) : (
        <FlatList
          data={artists}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={renderItem}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={renderEmpty}
          onEndReached={() => fetchArtists(true)}
          onEndReachedThreshold={0.5}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#8B1A1A"
            />
          }
        />
      )}
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

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#EDE0D4',
    backgroundColor: '#FAF7F2',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#EDE0D4',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#2A1005',
  },
  headerSpacer: {
    width: 36,
  },

  // List
  list: {
    padding: 20,
    gap: 12,
  },

  // Card
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#EDE0D4',
    shadowColor: '#2A1005',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
  },
  avatarFallback: {
    backgroundColor: '#FDF5F2',
    borderWidth: 1,
    borderColor: '#F0DDD8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#8B1A1A',
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2A1005',
    marginBottom: 3,
  },
  role: {
    fontSize: 12,
    fontWeight: '500',
    color: '#9B8265',
  },
  chevronBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#FDF5F2',
    borderWidth: 1,
    borderColor: '#F0DDD8',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Footer
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  footerSpacer: {
    height: 20,
  },

  // Empty
  emptyWrap: {
    alignItems: 'center',
    marginTop: 80,
    gap: 12,
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
});
