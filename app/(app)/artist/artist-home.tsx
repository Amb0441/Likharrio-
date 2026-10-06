import { Ionicons } from "@expo/vector-icons";
import { useGuardedRouter } from "../../../utils/navigationGuard";
import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  RefreshControl,
  ScrollView,
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
import { useLayoutMode } from "../../../hooks/useLayoutMode";
import { EventData, Portfolio } from "../../../lib/types";
import { formatEventDate, getGreeting, isEventPast } from "../../../lib/helpers";
import RealTimePerformance from "../../../components/analytics/RealTimePerformance";
import StatCards from "../../../components/home/StatCards";
import PortfolioGrid from "../../../components/home/PortfolioGrid";
import TrendingArtworks from "../../../components/home/TrendingArtworks";

// ─── Constants ────────────────────────────────────────────────────────────────
const MAX_BOARD_EVENTS = 3;

// ─── Component ────────────────────────────────────────────────────────────────
export default function ArtistHome() {
  const { user, userProfile } = useAuth();
  const { isWebsite } = useLayoutMode();
  const { guardedPush, guardedReplace } = useGuardedRouter();

  const [name, setName] = useState('');
  const [myEvents, setMyEvents] = useState<EventData[]>([]);
  const [allEvents, setAllEvents] = useState<EventData[]>([]);
  const [activeEventTab, setActiveEventTab] = useState<'mine' | 'all'>('mine');
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [trendingArtworks, setTrendingArtworks] = useState<Portfolio[]>([]);
  const [loadingTrending, setLoadingTrending] = useState(true);
  const [stats, setStats] = useState<{ followers: number; likes: number }>({
    followers: 0,
    likes: 0,
  });
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [loadingPortfolios, setLoadingPortfolios] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const isNavigating = useRef(false);

  // ── Safe navigation ──────────────────────────────────────────────────────────
  const safeNavigate = (pathname: string, params: any) => {
    if (isNavigating.current) return;
    isNavigating.current = true;
    guardedPush({ pathname: pathname as any, params });
    setTimeout(() => { isNavigating.current = false; }, 1000);
  };

  // ── One-time data fetch (getDocs) ───────────────────────────────────────────
  const fetchStaticData = useCallback(async (forceRefresh = false) => {
    if (!user) return;
    try {
      const myEventsKey = cacheKey('artist_my_events', user.uid);
      const allEventsKey = cacheKey('artist_all_events');
      const portfoliosKey = cacheKey('artist_portfolios', user.uid);

      if (!forceRefresh) {
        const cachedMyEvents = getCached<EventData[]>(myEventsKey);
        const cachedAllEvents = getCached<EventData[]>(allEventsKey);
        const cachedPortfolios = getCached<Portfolio[]>(portfoliosKey);
        if (cachedMyEvents && cachedAllEvents && cachedPortfolios) {
          setMyEvents(cachedMyEvents);
          setAllEvents(cachedAllEvents);
          setPortfolios(cachedPortfolios);
          setLoadingEvents(false);
          setLoadingPortfolios(false);
          return;
        }
      }

      setLoadingEvents(true);
      setLoadingPortfolios(true);

      const [
        myEventsSnap,
        allEventsSnap,
        portfoliosSnap,
      ] = await Promise.all([
        getDocs(
          query(
            collection(db, 'events'),
            where('artistId', '==', user.uid),
            orderBy('eventDate', 'desc'),
            limit(20),
          )
        ),
        getDocs(
          query(
            collection(db, 'events'),
            orderBy('eventDate', 'desc'),
            limit(20),
          )
        ),
        getDocs(
          query(
            collection(db, 'portfolios'),
            where('artistId', '==', user.uid),
            orderBy('createdAt', 'desc'),
            limit(5),
          )
        ),
      ]);

      const myEventsArr = myEventsSnap.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as EventData,
      );
      const allEventsArr = allEventsSnap.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as EventData,
      );
      const portfoliosArr = portfoliosSnap.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as Portfolio,
      );

      setMyEvents(myEventsArr);
      setAllEvents(allEventsArr);
      setPortfolios(portfoliosArr);
      setCache(myEventsKey, myEventsArr);
      setCache(allEventsKey, allEventsArr);
      setCache(portfoliosKey, portfoliosArr);
    } catch (e) {
      console.error('Error fetching artist home data:', e);
    } finally {
      setLoadingEvents(false);
      setLoadingPortfolios(false);
    }
  }, [user]);

  // ── Real-time stats: user doc + followers ground-truth ──────────────────────
  useEffect(() => {
    if (!user) return;

    setLoadingStats(true);

    const unsubUser = onSnapshot(
      doc(db, 'users', user.uid),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setName(data.name || data.email?.split('@')[0] || 'Artist');
        }
        setLoadingStats(false);
      },
    );

    const unsubFollowers = onSnapshot(
      query(
        collection(db, 'following'),
        where('artistId', '==', user.uid),
      ),
      (snap) =>
        setStats((prev) => ({ ...prev, followers: snap.size })),
    );

    return () => {
      unsubUser();
      unsubFollowers();
    };
  }, [user]);

  // ── Live likes: sum of portfolio.likes (same source as showcase hearts) ─────
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'portfolios'),
      where('artistId', '==', user.uid),
    );
    const unsub = onSnapshot(q, (snap) => {
      const total = snap.docs.reduce(
        (sum, d) => sum + (d.data().likes || 0),
        0,
      );
      setStats((prev) => ({ ...prev, likes: total }));
    });
    return () => unsub();
  }, [user]);

  // ── Real-time listeners (notifications only) ────────────────────────────────
  useEffect(() => {
    if (!user) return;

    fetchStaticData();

    const unsubNotifs = onSnapshot(
      query(
        collection(db, 'notifications'),
        where('userId', '==', user.uid),
        where('read', '==', false),
        limit(100),
      ),
      (snap) => setUnreadCount(snap.size),
    );

    return () => {
      unsubNotifs();
    };
  }, [user, fetchStaticData]);

  // ── Pull-to-refresh ─────────────────────────────────────────────────────────
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchStaticData(true);
    setRefreshing(false);
  }, [fetchStaticData]);

  // ── Discover: browse other artists' content ─────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const fetchTrending = async () => {
      try {
        const key = cacheKey('trending_artworks');
        const cached = getCached<Portfolio[]>(key);
        if (cached) {
          setTrendingArtworks(cached);
          setLoadingTrending(false);
          return;
        }
        const snap = await getDocs(
          query(
            collection(db, 'portfolios'),
            orderBy('createdAt', 'desc'),
            limit(10),
          ),
        );
        const all = snap.docs.map(
          (d) => ({ id: d.id, ...d.data() }) as Portfolio,
        );
        const filtered = all
          .filter((a) => a.artistId !== user?.uid)
          .slice(0, 6);
        setTrendingArtworks(filtered);
        setCache(key, filtered);
      } catch (e) {
        console.error('Error fetching trending artworks:', e);
      } finally {
        setLoadingTrending(false);
      }
    };
    fetchTrending();
  }, [user]);

  // ── Derived ─────────────────────────────────────────────────────────────────
  const boardSource = activeEventTab === 'mine' ? myEvents : allEvents;
  const boardEvents = boardSource.slice(0, MAX_BOARD_EVENTS);
  const hasMore = boardSource.length > MAX_BOARD_EVENTS;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.root} edges={isWebsite ? [] : ['top']}>
      <StatusBar barStyle="dark-content" />

      {!isWebsite && <View style={styles.header}>
        <View>
          <Text style={styles.headerGreeting}>{getGreeting()}</Text>
          <Text style={styles.headerName}>{name || 'Artist'}</Text>
        </View>
        <TouchableOpacity
          style={styles.notifBtn}
          onPress={() => guardedPush('/(app)/notifications')}
        >
          <Ionicons
            name="notifications-outline"
            size={22}
            color={COLORS.text.primary}
          />
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, isWebsite && styles.scrollWeb]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary.deepRed}
            colors={[COLORS.primary.deepRed]}
          />
        }
      >
        {isWebsite && <Text style={styles.webTitle}>Studio</Text>}
        {/* Verification banners */}
        {userProfile?.artistStatus === 'unsubmitted' && (
          <TouchableOpacity
            style={[
              styles.verifyBanner,
              { backgroundColor: COLORS.status.warning.bg },
            ]}
            onPress={() =>
              guardedPush('/(app)/artist/artist-verification' as any)
            }
          >
            <View
              style={[
                styles.verifyIcon,
                { backgroundColor: 'rgba(146,64,14,0.12)' },
              ]}
            >
              <Ionicons
                name="alert-circle-outline"
                size={18}
                color={COLORS.status.warning.text}
              />
            </View>
            <View style={styles.verifyTextWrap}>
              <Text
                style={[
                  styles.verifyTitle,
                  { color: COLORS.status.warning.text },
                ]}
              >
                Complete Your Verification
              </Text>
              <Text
                style={[styles.verifySub, { color: '#B45309' }]}
              >
                Upload your ID and sample artworks to start selling.
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={16}
              color={COLORS.status.warning.text}
            />
          </TouchableOpacity>
        )}

        {userProfile?.artistStatus === 'pending' && (
          <View
            style={[
              styles.verifyBanner,
              { backgroundColor: COLORS.status.info.bg },
            ]}
          >
            <View
              style={[
                styles.verifyIcon,
                { backgroundColor: 'rgba(30,64,175,0.12)' },
              ]}
            >
              <Ionicons
                name="time-outline"
                size={18}
                color={COLORS.status.info.text}
              />
            </View>
            <View style={styles.verifyTextWrap}>
              <Text
                style={[
                  styles.verifyTitle,
                  { color: COLORS.status.info.text },
                ]}
              >
                Verification Under Review
              </Text>
              <Text
                style={[styles.verifySub, { color: '#3B82F6' }]}
              >
                We're reviewing your documents. Usually 1–3 business days.
              </Text>
            </View>
          </View>
        )}

        {userProfile?.artistStatus === 'rejected' && (
          <TouchableOpacity
            style={[
              styles.verifyBanner,
              { backgroundColor: COLORS.status.error.bg },
            ]}
            onPress={() =>
              guardedPush('/(app)/artist/artist-verification' as any)
            }
          >
            <View
              style={[
                styles.verifyIcon,
                { backgroundColor: 'rgba(153,27,27,0.12)' },
              ]}
            >
              <Ionicons
                name="close-circle-outline"
                size={18}
                color={COLORS.status.error.text}
              />
            </View>
            <View style={styles.verifyTextWrap}>
              <Text
                style={[
                  styles.verifyTitle,
                  { color: COLORS.status.error.text },
                ]}
              >
                Verification Not Approved
              </Text>
              <Text
                style={[styles.verifySub, { color: '#DC2626' }]}
              >
                Tap to resubmit your documents.
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={16}
              color={COLORS.status.error.text}
            />
          </TouchableOpacity>
        )}

        {/* Real-Time Performance */}
        <RealTimePerformance artistId={user?.uid || ''} />

        {/* Stats */}
        <StatCards
          followers={stats.followers}
          likes={stats.likes}
          loading={loadingStats}
        />

        {/* Portfolio / Showcase */}
        <PortfolioGrid
          portfolios={portfolios}
          loading={loadingPortfolios}
          onViewAll={() => safeNavigate('/(app)/showcase/showcase-all', {})}
          onPressPortfolio={(id) =>
            safeNavigate('/(app)/showcase/showcase-detail', { id })
          }
        />

        {/* Events Board */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Events Board</Text>
            <TouchableOpacity
              onPress={() =>
                safeNavigate('/(app)/events/event-all', {
                  tab: activeEventTab,
                })
              }
            >
              <Text style={styles.viewAll}>View All</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.tabRow}>
            <TouchableOpacity
              style={[
                styles.tab,
                activeEventTab === 'mine' && styles.tabActive,
              ]}
              onPress={() => setActiveEventTab('mine')}
            >
              <Ionicons
                name="person-outline"
                size={13}
                color={
                  activeEventTab === 'mine'
                    ? COLORS.text.white
                    : COLORS.text.muted
                }
              />
              <Text
                style={[
                  styles.tabText,
                  activeEventTab === 'mine' && styles.tabTextActive,
                ]}
              >
                My Events
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.tab,
                activeEventTab === 'all' && styles.tabActive,
              ]}
              onPress={() => setActiveEventTab('all')}
            >
              <Ionicons
                name="earth-outline"
                size={13}
                color={
                  activeEventTab === 'all'
                    ? COLORS.text.white
                    : COLORS.text.muted
                }
              />
              <Text
                style={[
                  styles.tabText,
                  activeEventTab === 'all' && styles.tabTextActive,
                ]}
              >
                All Artists
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.eventsBoard}>
            {boardEvents.length === 0 && !loadingEvents ? (
              <View style={styles.emptyBox}>
                <Ionicons
                  name="calendar-outline"
                  size={36}
                  color={COLORS.text.muted}
                />
                <Text style={styles.emptyTitle}>
                  {activeEventTab === 'mine'
                    ? 'No Events Yet'
                    : 'No Events Found'}
                </Text>
                <Text style={styles.emptySub}>
                  {activeEventTab === 'mine'
                    ? 'Create your first event!'
                    : 'No events from other artists yet.'}
                </Text>
                {activeEventTab === 'mine' && (
                  <TouchableOpacity
                    style={styles.createBtn}
                    onPress={() =>
                      safeNavigate('/(app)/events/create-event', {})
                    }
                  >
                    <Ionicons name="add" size={15} color={COLORS.text.white} />
                    <Text style={styles.createBtnText}>Create Event</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <View style={styles.eventsList}>
                {boardEvents.map((event) => (
                  <TouchableOpacity
                    key={event.id}
                    style={styles.eventRow}
                    onPress={() =>
                      safeNavigate('/(app)/events/event-detail', {
                        id: event.id,
                      })
                    }
                  >
                    <View style={styles.eventDateBox}>
                      <Text style={styles.eventDateLabel}>
                        {formatEventDate(event.eventDate).split(' ')[0]}
                      </Text>
                      <Text style={styles.eventDateNum}>
                        {formatEventDate(event.eventDate).split(' ')[1]}
                      </Text>
                    </View>
                    <View style={styles.eventInfo}>
                      <Text style={styles.eventTitle} numberOfLines={1}>
                        {event.title}
                      </Text>
                      <Text style={styles.eventSub} numberOfLines={1}>
                        {activeEventTab === 'all' && event.artistName
                          ? `${event.artistName} · ${event.location}`
                          : event.location}
                      </Text>
                    </View>
                    {isEventPast(event.eventDate) && (
                      <View style={styles.pastBadge}>
                        <Text style={styles.pastBadgeText}>Past Due</Text>
                      </View>
                    )}
                    {activeEventTab === 'all' &&
                      event.artistId === user?.uid && (
                        <View style={styles.mineBadge}>
                          <Text style={styles.mineBadgeText}>Mine</Text>
                        </View>
                      )}
                  </TouchableOpacity>
                ))}

                {hasMore && (
                  <TouchableOpacity
                    style={styles.seeMoreRow}
                    onPress={() =>
                      safeNavigate('/(app)/events/event-all', {
                        tab: activeEventTab,
                      })
                    }
                  >
                    <Text style={styles.seeMoreText}>
                      +{boardSource.length - MAX_BOARD_EVENTS} more events
                    </Text>
                    <Ionicons
                      name="chevron-forward"
                      size={13}
                      color={COLORS.primary.deepRed}
                    />
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        </View>

        {/* Discover: Browse other artists' work */}
        <TrendingArtworks
          artworks={trendingArtworks}
          loading={loadingTrending}
          onViewAll={() =>
            safeNavigate('/(app)/enthusiast/enthusiast-list', {})
          }
          onPressArtwork={(id) =>
            safeNavigate('/(app)/showcase/showcase-detail', { id })
          }
        />

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background.primary,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: COLORS.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.primary,
  },
  headerGreeting: {
    fontSize: 12,
    color: COLORS.text.muted,
    fontWeight: '500',
    marginBottom: 2,
  },
  headerName: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text.primary,
    letterSpacing: -0.3,
  },
  notifBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.text.white,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.border.primary,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: COLORS.primary.deepRed,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: COLORS.text.white,
    fontSize: 9,
    fontWeight: '800',
  },

  scrollWeb: {
    width: '100%',
    maxWidth: 1180,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  webTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: COLORS.text.primary,
    letterSpacing: -0.6,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 4,
  },
  scroll: {
    paddingBottom: 24,
  },

  verifyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
  },
  verifyIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  verifyTextWrap: {
    flex: 1,
  },
  verifyTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  verifySub: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },

  section: {
    paddingHorizontal: 20,
    marginTop: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.text.primary,
  },
  viewAll: {
    fontSize: 13,
    color: COLORS.primary.deepRed,
    fontWeight: '600',
  },

  tabRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: COLORS.text.white,
    borderWidth: 1.5,
    borderColor: COLORS.border.primary,
  },
  tabActive: {
    backgroundColor: COLORS.primary.deepRed,
    borderColor: COLORS.primary.deepRed,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text.muted,
  },
  tabTextActive: {
    color: COLORS.text.white,
  },

  eventsBoard: {
    backgroundColor: COLORS.text.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: COLORS.border.primary,
  },
  eventsList: {
    gap: 10,
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  eventDateBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.ui.iconBackground,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  eventDateLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.primary.deepRed,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  eventDateNum: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.primary.deepRed,
    lineHeight: 18,
  },
  eventInfo: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text.primary,
    marginBottom: 2,
  },
  eventSub: {
    fontSize: 12,
    color: COLORS.text.muted,
  },
  mineBadge: {
    backgroundColor: COLORS.primary.deepRed,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  mineBadgeText: {
    color: COLORS.text.white,
    fontSize: 10,
    fontWeight: '700',
  },
  pastBadge: {
    backgroundColor: '#EDE0D4',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  pastBadgeText: {
    color: '#6B5946',
    fontSize: 10,
    fontWeight: '700',
  },
  seeMoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.badge.background,
  },
  seeMoreText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary.deepRed,
  },

  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    backgroundColor: COLORS.primary.deepRed,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  createBtnText: {
    color: COLORS.text.white,
    fontSize: 13,
    fontWeight: '600',
  },

  emptyBox: {
    alignItems: 'center',
    padding: 28,
    gap: 6,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text.secondary,
  },
  emptySub: {
    fontSize: 12,
    color: COLORS.text.muted,
    textAlign: 'center',
  },

  bottomSpacer: {
    height: 32,
  },
});
