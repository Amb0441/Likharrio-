import { Ionicons } from "@expo/vector-icons";
import { useGuardedRouter } from "../../../utils/navigationGuard";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import ReportModal from "../../../components/modals/ReportModal";
import COLORS from "../../../constants/Colors";
import { useAuth } from "../../../contexts/AuthContext";
import { db } from "../../../lib/firebase";
import { fetchOnce, getCached, setCache, cacheKey } from "../../../lib/dataCache";
import { notifyNewFollower } from "../../../utils/notifications";
import {
  getRecommendedArtworks,
  RecommendedArtwork,
} from "../../../utils/recommendations/recommendationEngine";
import ArtworkDetailsModal from "../../../components/modals/ArtworkDetailsModal";
import { Listing, Artist, EventData, ReportTargetType } from "../../../lib/types";
import { formatEventDate, getGreeting, showGuestAlert } from "../../../lib/helpers";
import ScreenHeader from "../../../components/ui/ScreenHeader";
import { useLayoutMode } from "../../../hooks/useLayoutMode";
import AdCarousel from "../../../components/home/AdCarousel";
import RecommendationCard from "../../../components/home/RecommendationCard";
import EventSection from "../../../components/home/EventSection";
import ArtistSection from "../../../components/home/ArtistSection";

export default function EnthusiastHome() {
  const { user, isGuestMode } = useAuth();
  const { guardedPush } = useGuardedRouter();
  const { isWebsite } = useLayoutMode();

  const [suggestedArtists, setSuggestedArtists] = useState<Artist[]>([]);
  const [events, setEvents] = useState<EventData[]>([]);
  const [loadingArtists, setLoadingArtists] = useState(true);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [userName, setUserName] = useState("");
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [recommendations, setRecommendations] = useState<RecommendedArtwork[]>([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(true);
  const [selectedArtwork, setSelectedArtwork] = useState<Listing | null>(null);
  const [artworkModalVisible, setArtworkModalVisible] = useState(false);
  const [selectedArtistName, setSelectedArtistName] = useState("");
  const [isArtworkSaved, setIsArtworkSaved] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportTargetId, setReportTargetId] = useState("");
  const [reportTargetTitle, setReportTargetTitle] = useState("");
  const [reportTargetType, setReportTargetType] = useState<ReportTargetType>("listing");
  const [refreshing, setRefreshing] = useState(false);

  // ── One-time data fetch ─────────────────────────────────────────────────────
  const fetchStaticData = useCallback(
    async (forceRefresh = false) => {
      if (!user && !isGuestMode) return;
      try {
        const artistsKey = cacheKey("home_artists");
        const eventsKey = cacheKey("home_events");

        if (!forceRefresh) {
          const cachedArtists = getCached<Artist[]>(artistsKey);
          const cachedEvents = getCached<EventData[]>(eventsKey);
          if (cachedArtists && cachedEvents) {
            setSuggestedArtists(cachedArtists);
            setEvents(cachedEvents);
            setLoadingArtists(false);
            setLoadingEvents(false);
            return;
          }
        }

        setLoadingArtists(true);
        setLoadingEvents(true);

        const [artistsSnap, eventsSnap] = await Promise.all([
          getDocs(
            query(
              collection(db, "users"),
              where("role", "==", "artist"),
              limit(5),
            ),
          ),
          getDocs(
            query(
              collection(db, "events"),
              orderBy("eventDate", "desc"),
              limit(5),
            ),
          ),
        ]);

        const artistsArr = artistsSnap.docs.map((d) => ({
          id: d.id,
          displayName: d.data().displayName || d.data().name || "Unknown Artist",
          role: d.data().artistType || "Artist",
          email: "",
          profileImage: d.data().profileImage || null,
        })) as Artist[];
        setSuggestedArtists(artistsArr);
        setCache(artistsKey, artistsArr);

        const eventsArr = eventsSnap.docs.map((d) => ({
          id: d.id,
          title: d.data().title,
          description: d.data().description || "",
          location: d.data().location || d.data().description,
          eventDate: d.data().eventDate,
          artistId: d.data().artistId || "",
          artistName: d.data().artistName || "",
        })) as EventData[];
        setEvents(eventsArr);
        setCache(eventsKey, eventsArr);
      } catch (e) {
        console.error("Error fetching enthusiast home data:", e);
      } finally {
        setLoadingArtists(false);
        setLoadingEvents(false);
      }
    },
    [user, isGuestMode],
  );

  // ── Fetch user name ─────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchUserName = async () => {
      if (!user) {
        if (isGuestMode) setUserName("Guest");
        return;
      }
      try {
        const key = cacheKey("user_name", user.uid);
        const cached = getCached<string>(key);
        if (cached) {
          setUserName(cached);
          return;
        }
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          const name = data.name || data.displayName || user.email?.split("@")[0] || "User";
          setUserName(name);
          setCache(key, name);
        }
      } catch (e) {
        console.error("Error fetching user name:", e);
      }
    };
    fetchUserName();
  }, [user, isGuestMode]);

  // ── Notifications listener ──────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "notifications"),
      where("userId", "==", user.uid),
      limit(100),
    );
    const unsub = onSnapshot(q, (snap) => {
      setUnreadNotifications(snap.docs.filter((d) => d.data().read === false).length);
    });
    return () => unsub();
  }, [user]);

  // ── Recommendations ─────────────────────────────────────────────────────────
  useEffect(() => {
    const loadRecs = async () => {
      if (!user) return;
      try {
        const key = cacheKey("recs", user.uid);
        const cached = getCached<RecommendedArtwork[]>(key);
        if (cached) {
          setRecommendations(cached);
          setLoadingRecommendations(false);
          return;
        }
        setLoadingRecommendations(true);
        const recs = await fetchOnce(key, () => getRecommendedArtworks(user.uid, 6));
        setRecommendations(recs);
      } catch (e) {
        console.error("Error loading recommendations:", e);
      } finally {
        setLoadingRecommendations(false);
      }
    };
    loadRecs();
  }, [user]);

  // ── Following IDs listener ──────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "following"),
      where("userId", "==", user.uid),
      limit(200),
    );
    const unsub = onSnapshot(q, (snap) => {
      setFollowingIds(snap.docs.map((d) => d.data().artistId));
    });
    return () => unsub();
  }, [user]);

  // ── Initial load ────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchStaticData();
  }, [fetchStaticData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchStaticData(true);
    setRefreshing(false);
  }, [fetchStaticData]);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleQuickFollow = async (artistId: string, artistName: string) => {
    if (!user || isGuestMode) {
      showGuestAlert(guardedPush, "follow artists");
      return;
    }
    try {
      await addDoc(collection(db, "following"), {
        userId: user.uid,
        artistId,
        createdAt: serverTimestamp(),
      });
      await notifyNewFollower(artistId, userName || "Someone", user.uid);
    } catch (e) {
      console.error("Error following artist:", e);
    }
  };

  const handleContact = async () => {
    if (!selectedArtwork || !user) return;
    if (isGuestMode) {
      setArtworkModalVisible(false);
      showGuestAlert(guardedPush, "contact artists");
      return;
    }
    setArtworkModalVisible(false);
    try {
      const chatsSnapshot = await getDocs(
        query(
          collection(db, "chats"),
          where("participants", "array-contains", user.uid),
        ),
      );
      let existingChatId: string | null = null;
      for (const chatDoc of chatsSnapshot.docs) {
        const d = chatDoc.data();
        if (
          d.participants.includes(selectedArtwork.artistId) &&
          d.listingId === selectedArtwork.id
        ) {
          existingChatId = chatDoc.id;
          break;
        }
      }

      const chatParams = {
        participantName: selectedArtistName,
        listingTitle: selectedArtwork.title,
        listingId: selectedArtwork.id,
      };

      if (existingChatId) {
        guardedPush({
          pathname: "/(app)/chat/detail",
          params: { id: existingChatId, ...chatParams },
        } as any);
      } else {
        const newChat = await addDoc(collection(db, "chats"), {
          participants: [user.uid, selectedArtwork.artistId],
          listingId: selectedArtwork.id,
          listingTitle: selectedArtwork.title,
          listingImage: selectedArtwork.imageUrl || "",
          listingPrice: selectedArtwork.price,
          lastMessage: "",
          lastMessageTime: serverTimestamp(),
          [`unread_${user.uid}`]: false,
          [`unread_${selectedArtwork.artistId}`]: false,
          createdAt: serverTimestamp(),
          participantNames: {
            [user.uid]: user.email?.split("@")[0] || "User",
            [selectedArtwork.artistId]: selectedArtistName,
          },
          participantEmails: {
            [user.uid]: user.email || "",
            [selectedArtwork.artistId]: selectedArtwork.artistEmail,
          },
        });
        guardedPush({
          pathname: "/(app)/chat/detail",
          params: { id: newChat.id, ...chatParams },
        } as any);
      }
    } catch (e) {
      console.error("Error creating chat:", e);
    }
  };

  const handleRecPress = (artwork: Listing, artistName: string) => {
    setSelectedArtwork(artwork);
    setSelectedArtistName(artistName);
    setArtworkModalVisible(true);
  };

  const handleRecLongPress = (id: string, title: string, type: "listing" | "artwork") => {
    if (isGuestMode) {
      showGuestAlert(guardedPush, "report content");
      return;
    }
    setReportTargetId(id);
    setReportTargetTitle(title);
    setReportTargetType(type);
    setReportModalVisible(true);
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.root} edges={isWebsite ? [] : ["top"]}>
      <StatusBar barStyle="dark-content" />

      {!isWebsite && (
        <ScreenHeader
          greeting={getGreeting()}
          userName={userName}
          notificationCount={unreadNotifications}
          onNotificationPress={() => {
            if (isGuestMode) {
              showGuestAlert(guardedPush, "view notifications");
              return;
            }
            guardedPush("/(app)/notifications");
          }}
        />
      )}

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
        {isWebsite && <Text style={styles.webTitle}>Home</Text>}

        {/* Ad Banner */}
        <View style={styles.section}>
          <AdCarousel />
        </View>

        {/* For You */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.forYouLabel}>
              <Ionicons name="sparkles" size={16} color={COLORS.primary.deepRed} />
              <Text style={styles.sectionTitle}>For You</Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                if (isGuestMode) {
                  showGuestAlert(guardedPush, "view personalized recommendations");
                  return;
                }
                guardedPush("/(app)/enthusiast/recommendations");
              }}
            >
              <Text style={styles.viewAll}>View All</Text>
            </TouchableOpacity>
          </View>

          {isGuestMode ? (
            <View style={[styles.guestCard, isWebsite && styles.guestCardWeb]}>
              <View style={styles.guestIconWrap}>
                <Ionicons name="person-outline" size={28} color={COLORS.primary.deepRed} />
              </View>
              <Text style={styles.guestTitle}>Sign in for recommendations</Text>
              <Text style={styles.guestSub}>
                Get artwork suggestions based on your interests
              </Text>
              <View style={styles.guestBtns}>
                <TouchableOpacity
                  style={styles.guestSignIn}
                  onPress={() => guardedPush("/(auth)/login")}
                >
                  <Text style={styles.guestSignInText}>Sign In</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.guestSignUp}
                  onPress={() => guardedPush("/(auth)/role-selection")}
                >
                  <Text style={styles.guestSignUpText}>Sign Up</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : loadingRecommendations ? (
            <View style={[styles.loadingRow, { gap: 10 }]}>
              <ActivityIndicator size="small" color="#8B1A1A" />
              <Text style={styles.loadingText}>Finding recommendations…</Text>
            </View>
          ) : recommendations.length > 0 ? (
            isWebsite ? (
              <View style={styles.recGrid}>
                {recommendations.map((rec) => (
                  <RecommendationCard
                    key={rec.id}
                    rec={rec}
                    onPress={handleRecPress}
                    onLongPress={handleRecLongPress}
                  />
                ))}
              </View>
            ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.recScroll}
              decelerationRate="fast"
              snapToInterval={212}
              snapToAlignment="start"
            >
              {recommendations.map((rec) => (
                <RecommendationCard
                  key={rec.id}
                  rec={rec}
                  onPress={handleRecPress}
                  onLongPress={handleRecLongPress}
                />
              ))}
            </ScrollView>
            )
          ) : (
            <TouchableOpacity
              style={styles.emptyRec}
              onPress={() => guardedPush("/(app)/showcase/showcase-all")}
            >
              <Ionicons name="heart-outline" size={28} color={COLORS.text.muted} />
              <Text style={styles.emptyRecText}>
                Explore artworks to get recommendations
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={isWebsite ? styles.webSplit : undefined}>
          <View style={isWebsite ? styles.webSplitCol : undefined}>
            <EventSection
              events={events}
              loading={loadingEvents}
              onViewAll={() => guardedPush("/(app)/events/event-public")}
              onPressEvent={(id) =>
                guardedPush({ pathname: "/(app)/events/event-detail", params: { id } })
              }
            />
          </View>
          <View style={isWebsite ? styles.webSplitCol : undefined}>
            <ArtistSection
              artists={suggestedArtists}
              loading={loadingArtists}
              followingIds={followingIds}
              onViewAll={() => guardedPush("/(app)/artist/allartist")}
              onPressArtist={(id) =>
                guardedPush({ pathname: "/(app)/artist/artist-profile-view", params: { id } })
              }
              onFollow={handleQuickFollow}
              onLongPress={(id, name) => {
                if (isGuestMode) {
                  showGuestAlert(guardedPush, "report content");
                  return;
                }
                setReportTargetId(id);
                setReportTargetTitle(name);
                setReportTargetType("artist");
                setReportModalVisible(true);
              }}
            />
          </View>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      <ArtworkDetailsModal
        visible={artworkModalVisible}
        listing={selectedArtwork}
        artistName={selectedArtistName}
        isSaved={isArtworkSaved}
        isGuestMode={isGuestMode}
        onClose={() => {
          setArtworkModalVisible(false);
          setSelectedArtwork(null);
        }}
        onShare={async () => {
          if (selectedArtwork) {
            try {
              await Share.share({
                message: `Check out this artwork: ${selectedArtwork.title} - ₱${selectedArtwork.price.toLocaleString()}`,
              });
            } catch (e) {
              console.error("Error sharing:", e);
            }
          }
        }}
        onToggleSave={async () => {
          if (!user || !selectedArtwork) return;
          if (isGuestMode) {
            showGuestAlert(guardedPush, "save artworks");
            return;
          }
          try {
            const saveId = `${user.uid}_${selectedArtwork.id}`;
            const saveRef = doc(db, "saves", saveId);
            const saveDoc = await getDoc(saveRef);
            if (saveDoc.exists()) {
              await deleteDoc(saveRef);
              setIsArtworkSaved(false);
            } else {
              await setDoc(saveRef, {
                userId: user.uid,
                listingId: selectedArtwork.id,
                createdAt: new Date(),
              });
              setIsArtworkSaved(true);
            }
          } catch (e) {
            console.error("Error toggling save:", e);
          }
        }}
        onContactArtist={handleContact}
        onReport={() => {
          if (isGuestMode) {
            showGuestAlert(guardedPush, "report content");
            return;
          }
          if (selectedArtwork) {
            setReportTargetId(selectedArtwork.id);
            setReportTargetTitle(selectedArtwork.title);
            setReportTargetType("listing");
            setReportModalVisible(true);
          }
        }}
        onArtistPress={
          selectedArtwork?.artistId && user?.uid !== selectedArtwork.artistId
            ? () => {
                setArtworkModalVisible(false);
                setSelectedArtwork(null);
                guardedPush({
                  pathname: "/(app)/artist/artist-profile-view",
                  params: { id: selectedArtwork.artistId },
                });
              }
            : undefined
        }
      />

      <ReportModal
        visible={reportModalVisible}
        onClose={() => setReportModalVisible(false)}
        targetId={reportTargetId}
        targetType={reportTargetType}
        reportedBy={user?.uid || ""}
        targetTitle={reportTargetTitle}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background.primary,
  },
  scroll: {
    paddingBottom: 24,
  },
  scrollWeb: {
    width: "100%",
    maxWidth: 1180,
    alignSelf: "center",
    paddingHorizontal: 28,
    paddingTop: 8,
  },
  webTitle: {
    fontSize: 32,
    fontWeight: "800",
    color: COLORS.text.primary,
    letterSpacing: -0.6,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  webSplit: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  webSplitCol: {
    flex: 1,
    minWidth: 280,
  },
  recGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
  },
  section: {
    paddingHorizontal: 20,
    marginTop: 24,
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
    lineHeight: 22,
  },
  viewAll: {
    fontSize: 13,
    color: COLORS.primary.deepRed,
    fontWeight: "600",
    lineHeight: 22,
  },
  forYouLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  recScroll: {
    gap: 12,
    paddingRight: 20,
  },
  emptyRec: {
    alignItems: "center",
    paddingVertical: 32,
    gap: 10,
    backgroundColor: COLORS.text.white,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: COLORS.border.primary,
  },
  emptyRecText: {
    fontSize: 13,
    color: COLORS.text.muted,
    textAlign: "center",
  },
  guestCard: {
    backgroundColor: COLORS.text.white,
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    gap: 10,
    borderWidth: 1.5,
    borderColor: COLORS.border.primary,
  },
  guestCardWeb: {
    width: "100%",
  },
  guestIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: COLORS.ui.iconBackground,
    justifyContent: "center",
    alignItems: "center",
  },
  guestTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.text.primary,
    textAlign: "center",
  },
  guestSub: {
    fontSize: 12,
    color: COLORS.text.muted,
    textAlign: "center",
    lineHeight: 18,
  },
  guestBtns: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
    width: "100%",
  },
  guestSignIn: {
    flex: 1,
    backgroundColor: COLORS.primary.deepRed,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  guestSignInText: {
    color: COLORS.text.white,
    fontSize: 13,
    fontWeight: "700",
  },
  guestSignUp: {
    flex: 1,
    borderWidth: 2,
    borderColor: COLORS.primary.deepRed,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  guestSignUpText: {
    color: COLORS.primary.deepRed,
    fontSize: 13,
    fontWeight: "700",
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    color: COLORS.text.muted,
  },
  bottomSpacer: {
    height: 32,
  },
});
