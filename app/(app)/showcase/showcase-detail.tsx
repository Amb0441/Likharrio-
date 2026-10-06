import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import COLORS from "../../../constants/Colors";
import { useAuth } from "../../../contexts/AuthContext";
import { db } from "../../../lib/firebase";
import { getCached, setCache } from "../../../lib/dataCache";
import { showGuestAlert } from "../../../lib/helpers";
import type { Portfolio } from "../../../lib/types";
import ReportModal from "../../../components/modals/ReportModal";
import CommentSection from "../../../components/social/CommentSection";
import ShowcaseActions from "../../../components/showcase/ShowcaseActions";
import ShowcaseHeader from "../../../components/showcase/ShowcaseHeader";
import { notifyLike } from "../../../utils/notifications";
import { useGuardedRouter } from "../../../utils/navigationGuard";

const VIEW_COOLDOWN_MS = 5 * 60 * 1000;

export default function ShowcaseDetail() {
  const { id } = useLocalSearchParams();
  const { guardedPush, guardedBack } = useGuardedRouter();
  const { user, isGuestMode } = useAuth();
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [artistName, setArtistName] = useState("");
  const [artistImage, setArtistImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSlide, setActiveSlide] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [fullScreenImage, setFullScreenImage] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isNavigating = useRef(false);

  const safeBack = () => {
    if (isNavigating.current) return;
    isNavigating.current = true;
    guardedBack();
    setTimeout(() => {
      isNavigating.current = false;
    }, 1000);
  };

  useEffect(() => {
    if (!id) return;
    fetchPortfolio();
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const portfolioRef = doc(
      db,
      "portfolios",
      id as string,
    );
    const unsubscribe = onSnapshot(
      portfolioRef,
      (docSnap) => {
        if (docSnap.exists() && !isSubmitting) {
          const data = docSnap.data();
          setPortfolio((prev: Portfolio | null) => {
            if (!prev) return null;
            return {
              ...prev,
              likes: data.likes || 0,
              views: data.views || 0,
            };
          });
        }
      },
    );
    return () => unsubscribe();
  }, [id, isSubmitting]);

  useEffect(() => {
    if (!user || !id) return;
    const likeDocRef = doc(
      db,
      "likes",
      `${user.uid}_${id}`,
    );
    const unsubscribe = onSnapshot(
      likeDocRef,
      (docSnap) => {
        if (!isSubmitting) setIsLiked(docSnap.exists());
      },
    );
    return () => unsubscribe();
  }, [user, id, isSubmitting]);

  useEffect(() => {
    if (!user || !id) return;
    const savedQuery = query(
      collection(db, "saved"),
      where("userId", "==", user.uid),
      where("targetId", "==", id as string),
      limit(1),
    );
    const unsubscribe = onSnapshot(
      savedQuery,
      (snapshot) => {
        setIsSaved(!snapshot.empty);
      },
    );
    return () => unsubscribe();
  }, [user, id]);

  const fetchPortfolio = async () => {
    try {
      const cacheKey = `portfolio_${id}`;
      const cached = getCached<Portfolio>(cacheKey);
      if (cached) {
        setPortfolio(cached);
        setLoading(false);
      }

      const docRef = doc(
        db,
        "portfolios",
        id as string,
      );
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        const fullPortfolio = {
          id: docSnap.id,
          ...data,
        } as Portfolio;
        setCache(`portfolio_${id}`, fullPortfolio);
        setPortfolio(fullPortfolio);

        if (
          user &&
          fullPortfolio.artistId !== user.uid
        ) {
          handleViewCount(fullPortfolio.id);
        }

        if (fullPortfolio.artistId) {
          getDoc(
            doc(db, "users", fullPortfolio.artistId),
          )
            .then((userDoc) => {
              if (userDoc.exists()) {
                const userData = userDoc.data();
                setArtistName(
                  userData.name ||
                    userData.displayName ||
                    fullPortfolio.artistEmail?.split(
                      "@",
                    )[0] ||
                      "Unknown Artist",
                );
                setArtistImage(
                  userData.profileImage || null,
                );
              }
            })
            .catch((e) => {
              console.error(
                "Error fetching artist info:",
                e,
              );
              setArtistName("Unknown Artist");
            });
        }
      }
    } catch (error) {
      console.error("Error fetching portfolio:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewCount = async (
    portfolioId: string,
  ) => {
    if (!user) return;
    try {
      const viewTrackingId = `${user.uid}_${portfolioId}`;
      const viewTrackingRef = doc(
        db,
        "viewTracking",
        viewTrackingId,
      );
      const viewDoc = await getDoc(viewTrackingRef);
      const now = new Date();

      if (viewDoc.exists()) {
        const lastViewTime =
          viewDoc.data().lastViewTime?.toDate();
        if (lastViewTime) {
          const timeSinceLastView =
            now.getTime() - lastViewTime.getTime();
          if (timeSinceLastView < VIEW_COOLDOWN_MS) {
            const remainingMinutes = Math.ceil(
              (VIEW_COOLDOWN_MS - timeSinceLastView) /
                60000,
            );
            console.log(
              `View cooldown active. ${remainingMinutes} minutes remaining.`,
            );
            return;
          }
        }
      }

      const portfolioRef = doc(
        db,
        "portfolios",
        portfolioId,
      );
      await updateDoc(portfolioRef, {
        views: increment(1),
      });
      await setDoc(
        viewTrackingRef,
        {
          userId: user.uid,
          portfolioId,
          lastViewTime: serverTimestamp(),
          viewCount: increment(1),
        },
        { merge: true },
      );
    } catch (error) {
      console.error(
        "Error handling view count:",
        error,
      );
    }
  };

  const handleLike = async () => {
    if (!user || !portfolio) {
      showGuestAlert(guardedPush, "like artworks");
      return;
    }
    if (isSubmitting) return;

    setIsSubmitting(true);
    const previousLikedState = isLiked;
    const previousLikesCount = portfolio.likes || 0;

    try {
      await runTransaction(db, async (transaction) => {
        const portfolioRef = doc(
          db,
          "portfolios",
          portfolio.id,
        );
        const likeRef = doc(
          db,
          "likes",
          `${user.uid}_${portfolio.id}`,
        );
        const portfolioDoc =
          await transaction.get(portfolioRef);
        const likeDoc =
          await transaction.get(likeRef);

        if (!portfolioDoc.exists())
          throw "Portfolio does not exist!";

        if (likeDoc.exists()) {
          transaction.delete(likeRef);
          transaction.update(portfolioRef, {
            likes: increment(-1),
          });
          transaction.set(
            doc(db, "users", portfolio.artistId),
            { likesCount: increment(-1) },
            { merge: true },
          );
        } else {
          transaction.set(likeRef, {
            userId: user.uid,
            targetId: portfolio.id,
            type: "portfolio",
            createdAt: serverTimestamp(),
          });
          transaction.update(portfolioRef, {
            likes: increment(1),
          });
          transaction.set(
            doc(db, "users", portfolio.artistId),
            { likesCount: increment(1) },
            { merge: true },
          );
        }
      });

      if (
        !isLiked &&
        portfolio.artistId !== user.uid
      ) {
        try {
          const likerDoc = await getDoc(
            doc(db, "users", user.uid),
          );
          const likerName =
            likerDoc.data()?.name ||
            likerDoc.data()?.displayName ||
            user.email?.split("@")[0] ||
            "Someone";
          await notifyLike(
            portfolio.artistId,
            likerName,
            user.uid,
            portfolio.title,
            portfolio.id,
            "portfolio",
            portfolio.coverImage,
          );
        } catch (notifyErr) {
          console.warn(
            "Failed to send like notification:",
            notifyErr,
          );
        }
      }
    } catch (error) {
      console.error("Transaction failed:", error);
      setIsLiked(previousLikedState);
      setPortfolio((prev: Portfolio | null) =>
        prev
          ? { ...prev, likes: previousLikesCount }
          : null,
      );
      Alert.alert(
        "Error",
        "Connection too slow or error occurred. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSave = async () => {
    if (!user || !portfolio) {
      showGuestAlert(guardedPush, "save artworks");
      return;
    }

    try {
      const portfolioRef = doc(
        db,
        "portfolios",
        portfolio.id,
      );
      if (isSaved) {
        const q = query(
          collection(db, "saved"),
          where("userId", "==", user.uid),
          where("targetId", "==", portfolio.id),
        );
        const snapshot = await getDocs(q);
        snapshot.forEach((d) => deleteDoc(d.ref));
        await updateDoc(portfolioRef, {
          saves: increment(-1),
        });
      } else {
        await addDoc(collection(db, "saved"), {
          userId: user.uid,
          targetId: portfolio.id,
          type: "portfolio",
          createdAt: serverTimestamp(),
        });
        await updateDoc(portfolioRef, {
          saves: increment(1),
        });
      }
    } catch (error) {
      console.error("Error toggling save:", error);
      Alert.alert(
        "Error",
        "Failed to update save. Please try again.",
      );
    }
  };

  const handleContact = async () => {
    if (!user || !portfolio) {
      showGuestAlert(
        guardedPush,
        "contact artists",
      );
      return;
    }
    if (isGuestMode) {
      showGuestAlert(
        guardedPush,
        "contact artists",
      );
      return;
    }

    try {
      const chatsSnapshot = await getDocs(
        query(
          collection(db, "chats"),
          where(
            "participants",
            "array-contains",
            user.uid,
          ),
        ),
      );
      let existingChatId: string | null = null;
      for (const chatDoc of chatsSnapshot.docs) {
        const chatData = chatDoc.data();
        if (
          chatData.participants.includes(
            portfolio.artistId,
          ) &&
          chatData.portfolioId === portfolio.id
        ) {
          existingChatId = chatDoc.id;
          break;
        }
      }

      if (existingChatId) {
        guardedPush({
          pathname: "/(app)/chat/detail",
          params: {
            id: existingChatId,
            participantName: artistName,
            fromShowcase: "true",
          },
        });
      } else {
        const newChat = await addDoc(
          collection(db, "chats"),
          {
            participants: [
              user.uid,
              portfolio.artistId,
            ],
            portfolioId: portfolio.id,
            portfolioTitle: portfolio.title,
            portfolioImage: portfolio.coverImage,
            lastMessage: "",
            lastMessageTime: serverTimestamp(),
            [`unread_${user.uid}`]: false,
            [`unread_${portfolio.artistId}`]: false,
            createdAt: serverTimestamp(),
            participantNames: {
              [user.uid]:
                user.displayName ||
                user.email?.split("@")[0] ||
                "User",
              [portfolio.artistId]: artistName,
            },
            participantEmails: {
              [user.uid]: user.email || "",
              [portfolio.artistId]:
                portfolio.artistEmail,
            },
          },
        );
        guardedPush({
          pathname: "/(app)/chat/detail",
          params: {
            id: newChat.id,
            participantName: artistName,
            fromShowcase: "true",
          },
        });
      }
    } catch (error) {
      console.error(
        "Error creating/opening chat:",
        error,
      );
      Alert.alert(
        "Error",
        "Failed to start chat. Please try again.",
      );
    }
  };

  const handleShare = async () => {
    if (!portfolio) return;
    try {
      await Share.share({
        message: `Check out this artwork: ${portfolio.title} by ${artistName}`,
        title: portfolio.title,
      });
    } catch (error) {
      console.error("Error sharing:", error);
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "";
    const date = timestamp.toDate
      ? timestamp.toDate()
      : new Date(timestamp);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator
          size="large"
          color={COLORS.primary.deepRed}
        />
      </View>
    );
  }

  if (!portfolio) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={safeBack}>
            <Ionicons
              name="arrow-back"
              size={24}
              color={COLORS.text.primary}
            />
          </TouchableOpacity>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>
            Showcase not found
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const isOwner =
    user && portfolio.artistId === user.uid;

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={styles.scrollView}
      >
        <ShowcaseHeader
          portfolio={portfolio}
          activeSlide={activeSlide}
          isOwner={!!isOwner}
          fullScreenImage={fullScreenImage}
          setActiveSlide={setActiveSlide}
          setFullScreenImage={setFullScreenImage}
          safeBack={safeBack}
          guardedPush={guardedPush}
        />

        <View style={styles.contentContainer}>
          <TouchableOpacity
            style={styles.artistContainer}
            onPress={() => {
              if (!isOwner) {
                guardedPush({
                  pathname:
                    "/(app)/artist/artist-profile-view",
                  params: { id: portfolio.artistId },
                });
              }
            }}
            activeOpacity={!isOwner ? 0.7 : 1}
          >
            {artistImage ? (
              <View style={styles.artistAvatarWrap}>
                <Image
                  source={{ uri: artistImage }}
                  style={styles.artistAvatarImg}
                  resizeMode="cover"
                />
              </View>
            ) : (
              <View style={styles.artistAvatar}>
                <Text style={styles.artistAvatarText}>
                  {artistName
                    ? artistName.charAt(0).toUpperCase()
                    : "?"}
                </Text>
              </View>
            )}
            <View style={styles.artistInfo}>
              <Text style={styles.artistLabel}>
                Created by
              </Text>
              <Text
                style={styles.artistName}
                numberOfLines={1}
              >
                {artistName}
              </Text>
            </View>
            <Text style={styles.dateText}>
              {formatDate(portfolio.createdAt)}
            </Text>
          </TouchableOpacity>

          <View style={styles.titleRow}>
            <Text style={styles.title}>
              {portfolio.title}
            </Text>
            <ShowcaseActions
              isLiked={isLiked}
              isSaved={isSaved}
              isSubmitting={isSubmitting}
              isOwner={!!isOwner}
              isGuestMode={isGuestMode}
              likes={portfolio.likes || 0}
              views={portfolio.views || 0}
              guardedPush={guardedPush}
              onLike={handleLike}
              onSave={handleSave}
              onShare={handleShare}
              onReport={() =>
                setReportModalVisible(true)
              }
            />
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Ionicons
                name="heart"
                size={18}
                color={COLORS.primary.deepRed}
              />
              <Text style={styles.statValue}>
                {Math.max(0, portfolio.likes || 0)} Likes
              </Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Ionicons
                name="eye"
                size={18}
                color={COLORS.text.secondary}
              />
              <Text style={styles.statValue}>
                {portfolio.views || 0} Views
              </Text>
            </View>
          </View>

          <View style={styles.divider} />
          <Text style={styles.sectionLabel}>
            About this piece
          </Text>
          <Text style={styles.description}>
            {portfolio.description}
          </Text>

          {portfolio.tags &&
            portfolio.tags.length > 0 && (
              <View style={styles.tagsSection}>
                <Text
                  style={styles.sectionLabelSmall}
                >
                  Tags
                </Text>
                <View style={styles.tagsContainer}>
                  {portfolio.tags.map(
                    (tag: string, index: number) => (
                      <View
                        key={index}
                        style={styles.tagChip}
                      >
                        <Text style={styles.tagText}>
                          #{tag}
                        </Text>
                      </View>
                    ),
                  )}
                </View>
              </View>
            )}

          <CommentSection
            portfolioId={portfolio.id}
            portfolioOwnerId={portfolio.artistId}
            portfolioTitle={portfolio.title}
            portfolioCoverImage={portfolio.coverImage}
            currentUserId={user?.uid}
            isGuestMode={isGuestMode}
            onSignInRequired={() => {
              showGuestAlert(
                guardedPush,
                "comment",
              );
            }}
          />
          <View style={styles.bottomSpacer} />
        </View>
      </ScrollView>

      {isOwner === false && (
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={styles.chatButton}
            onPress={handleContact}
          >
            <Ionicons
              name="chatbubble-outline"
              size={20}
              color={COLORS.text.white}
            />
            <Text style={styles.chatButtonText}>
              Chat with Artist
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <ReportModal
        visible={reportModalVisible}
        onClose={() => setReportModalVisible(false)}
        targetId={portfolio?.id || ""}
        targetType="artwork"
        reportedBy={user?.uid || ""}
        targetTitle={portfolio?.title || ""}
        targetImage={portfolio?.coverImage || ""}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background.primary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.background.primary,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    fontSize: 16,
    color: "#666",
  },
  contentContainer: {
    padding: 24,
    backgroundColor: COLORS.background.primary,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    marginTop: -24,
    minHeight: 500,
    shadowColor: "#2A1005",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
  },
  artistContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.light,
  },
  artistAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary.deepRed,
    justifyContent: "center",
    alignItems: "center",
  },
  artistAvatarWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: COLORS.border.light,
  },
  artistAvatarImg: {
    width: "100%",
    height: "100%",
    borderRadius: 22,
  },
  artistAvatarText: {
    color: COLORS.text.white,
    fontSize: 18,
    fontWeight: "bold",
  },
  artistInfo: {
    flex: 1,
  },
  artistLabel: {
    fontSize: 12,
    color: COLORS.text.muted,
  },
  artistName: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.text.primary,
  },
  dateText: {
    fontSize: 12,
    color: COLORS.text.muted,
    fontWeight: "500",
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: COLORS.text.primary,
    lineHeight: 30,
    flex: 1,
    letterSpacing: -0.3,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border.primary,
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 17,
    fontWeight: "700",
    color: COLORS.text.primary,
    marginBottom: 10,
  },
  sectionLabelSmall: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.text.muted,
    marginBottom: 10,
  },
  description: {
    fontSize: 15,
    color: "#6B5946",
    lineHeight: 23,
    marginBottom: 28,
  },
  tagsSection: {
    marginTop: 8,
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tagChip: {
    backgroundColor: COLORS.background.secondary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border.light,
  },
  tagText: {
    color: COLORS.primary.deepRed,
    fontSize: 13,
    fontWeight: "600",
  },
  bottomBar: {
    flexDirection: "row",
    padding: 16,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: COLORS.border.primary,
    backgroundColor: COLORS.text.white,
  },
  chatButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
    borderRadius: 14,
    backgroundColor: COLORS.primary.deepRed,
    gap: 8,
    shadowColor: COLORS.primary.deepRed,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  chatButtonText: {
    color: COLORS.text.white,
    fontSize: 16,
    fontWeight: "700",
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
    marginBottom: 20,
    backgroundColor: COLORS.background.secondary,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border.light,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statDivider: {
    width: 1,
    height: 18,
    backgroundColor: COLORS.border.primary,
  },
  statValue: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.text.secondary,
  },
  bottomSpacer: {
    height: 40,
  },
});
