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
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where
} from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import COLORS from "../../../constants/Colors";
import { useAuth } from "../../../contexts/AuthContext";
import { db } from "../../../lib/firebase";
import { getCached, setCache, cacheKey } from "../../../lib/dataCache";
import { useGuardedRouter } from "../../../utils/navigationGuard";

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface PortfolioData {
  id: string;
  title: string;
  description: string;
  artistEmail: string;
  artistId: string;
  category: string;
  tags: string[];
  images: string[]; 
  likes: number;
  views: number;
  createdAt: any;
}

export default function PortfolioDetails() {
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState(0);
  const [artistName, setArtistName] = useState<string>("");
  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  // LOCK STATE: Disables the button visually and logically
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { guardedPush, guardedReplace, guardedBack } = useGuardedRouter();

  useEffect(() => {
    const fetchPortfolio = async () => {
      if (!id) return;

      try {
        const cacheKeyStr = cacheKey('portfolio_details', id as string);
        const cached = getCached<{ portfolio: PortfolioData; artistName: string }>(cacheKeyStr);
        if (cached) {
          setPortfolio(cached.portfolio);
          setArtistName(cached.artistName);
          setLoading(false);
          return;
        }

        const docRef = doc(db, 'portfolios', id as string);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = { id: docSnap.id, ...docSnap.data() } as PortfolioData;
          let name = data.artistEmail?.split('@')[0] || "Unknown Artist";

          if (data.artistId) {
            const userDoc = await getDoc(doc(db, 'users', data.artistId));
            if (userDoc.exists()) {
              const userData = userDoc.data();
              name = userData.name || userData.displayName || name;
            }
          }
          setPortfolio(data);
          setArtistName(name);
          setCache(cacheKeyStr, { portfolio: data, artistName: name });

          await updateDoc(docRef, {
            views: increment(1)
          });
        }
      } catch (error) {
        console.error("Error fetching details:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPortfolio();
  }, [id]);

  // Listener for Likes
  useEffect(() => {
    if (!user || !id) return;

    // Use a deterministic ID: userId_portfolioId
    const likeDocId = `${user.uid}_${id}`;
    const likeDocRef = doc(db, 'likes', likeDocId);

    const unsubscribe = onSnapshot(likeDocRef, (docSnap) => {
      // Only update local state if we aren't currently submitting
      if (!isSubmitting) {
        setIsLiked(docSnap.exists());
      }
    });

    return () => unsubscribe();
  }, [user, id, isSubmitting]);

  useEffect(() => {
    if (!user || !id) return;

    const savedQuery = query(
      collection(db, 'saved'),
      where('userId', '==', user.uid),
      where('targetId', '==', id as string)
    );

    const unsubscribe = onSnapshot(savedQuery, (snapshot) => {
      setIsSaved(!snapshot.empty);
    });

    return () => unsubscribe();
  }, [user, id]);

  const getArtistColor = (str: string) => {
    const colors = [COLORS.primary.deepRed, COLORS.primary.forestGreen, COLORS.secondary.goldenYellow, "#3F51B5", "#00897B"];
    let hash = 0;
    if (str) {
      for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
      }
    }
    return colors[Math.abs(hash) % colors.length];
  };

  // ==========================================
  // TRANSACTION-BASED HANDLE LIKE
  // ==========================================
  const handleLike = async () => {
    if (!user || !portfolio) {
      Alert.alert("Login Required", "Please login to like this artwork.");
      return;
    }

    // 1. STOP: If already submitting, ignore click.
    if (isSubmitting) return;

    // 2. LOCK: Disable button immediately
    setIsSubmitting(true);

    // Optimistic UI Update (for speed)
    const previousLikedState = isLiked;
    const previousLikesCount = portfolio.likes;
    
    // Visually toggle immediately
    setIsLiked(!previousLikedState);
    setPortfolio(prev => {
        if (!prev) return null;
        let newCount = previousLikedState ? prev.likes - 1 : prev.likes + 1;
        return { ...prev, likes: Math.max(0, newCount) };
    });

    try {
      // 3. EXECUTE TRANSACTION (The Logic Core)
      await runTransaction(db, async (transaction) => {
        // References
        const portfolioRef = doc(db, 'portfolios', portfolio.id);
        const likeId = `${user.uid}_${portfolio.id}`; // UNIQUE ID
        const likeRef = doc(db, 'likes', likeId);
        const artistRef = doc(db, 'users', portfolio.artistId);

        // Read current state from DB (Atomic Read)
        const portfolioDoc = await transaction.get(portfolioRef);
        const likeDoc = await transaction.get(likeRef);

        if (!portfolioDoc.exists()) {
          throw "Portfolio does not exist!";
        }

        if (likeDoc.exists()) {
          // --- CASE: UNLIKE ---
          transaction.delete(likeRef);
          transaction.update(portfolioRef, { likes: increment(-1) });
          // Decrement artist's cached likesCount (merge:true creates field if missing)
          transaction.set(artistRef, { likesCount: increment(-1) }, { merge: true });
        } else {
          // --- CASE: LIKE ---
          transaction.set(likeRef, {
            userId: user.uid,
            targetId: portfolio.id,
            type: 'portfolio',
            createdAt: serverTimestamp()
          });
          transaction.update(portfolioRef, { likes: increment(1) });
          // Increment artist's cached likesCount (merge:true creates field if missing)
          transaction.set(artistRef, { likesCount: increment(1) }, { merge: true });
        }
      });

      // Transaction success! State is already optimistic, so we leave it.

    } catch (error) {
      console.error("Transaction failed: ", error);
      // Revert UI on failure
      setIsLiked(previousLikedState);
      setPortfolio(prev => prev ? ({ ...prev, likes: previousLikesCount }) : null);
      Alert.alert("Error", "Connection too slow or error occurred. Please try again.");
    } finally {
      // 4. UNLOCK: Re-enable button after a short delay
      setTimeout(() => {
        setIsSubmitting(false);
      }, 200);
    }
  };

  const handleSave = async () => {
    if (!user || !portfolio) {
      Alert.alert("Login Required", "Please login to save this artwork.");
      return;
    }

    try {
      const portfolioRef = doc(db, 'portfolios', portfolio.id);

      if (isSaved) {
        const q = query(
          collection(db, 'saved'),
          where('userId', '==', user.uid),
          where('targetId', '==', portfolio.id)
        );
        const snapshot = await getDocs(q);
        snapshot.forEach((doc) => deleteDoc(doc.ref));

        await updateDoc(portfolioRef, { saves: increment(-1) });
      } else {
        await addDoc(collection(db, 'saved'), {
          userId: user.uid,
          targetId: portfolio.id,
          type: 'portfolio',
          createdAt: serverTimestamp()
        });

        await updateDoc(portfolioRef, { saves: increment(1) });
      }
    } catch (error) {
      console.error("Error toggling save:", error);
      Alert.alert("Error", "Failed to update save. Please try again.");
    }
  };

  const handleContact = async () => {
    if (!user || !portfolio) {
      Alert.alert("Login Required", "Please login to contact the artist.");
      return;
    }

    try {
      const chatsQuery = query(
        collection(db, 'chats'),
        where('participants', 'array-contains', user.uid)
      );
      
      const chatsSnapshot = await getDocs(chatsQuery);
      let existingChatId: string | null = null;

      for (const chatDoc of chatsSnapshot.docs) {
        const chatData = chatDoc.data();
        if (chatData.participants.includes(portfolio.artistId)) {
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
          }
        });
      } else {
        const newChat = await addDoc(collection(db, 'chats'), {
          participants: [user.uid, portfolio.artistId],
          lastMessage: '',
          lastMessageTime: serverTimestamp(),
          [`unread_${user.uid}`]: false,
          [`unread_${portfolio.artistId}`]: false,
          createdAt: serverTimestamp(),
          participantNames: {
            [user.uid]: user.displayName || user.email?.split('@')[0] || 'User',
            [portfolio.artistId]: artistName
          },
          participantEmails: {
            [user.uid]: user.email || '',
            [portfolio.artistId]: portfolio.artistEmail
          }
        });
        
        guardedPush({
          pathname: "/(app)/chat/detail",
          params: {
            id: newChat.id,
            participantName: artistName,
          }
        });
      }
    } catch (error) {
      console.error('Error creating/opening chat:', error);
      Alert.alert("Error", "Failed to start chat. Please try again.");
    }
  };

  const handleShare = async () => {
    if (!portfolio) return;
    try {
      await Share.share({
        message: `Check out this artwork: ${portfolio.title} by ${portfolio.artistEmail?.split('@')[0]}`,
        title: portfolio.title,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary.deepRed || "#E91E63"} />
      </View>
    );
  }

  if (!portfolio) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={{ textAlign: 'center', marginTop: 20 }}>Portfolio not found</Text>
        <TouchableOpacity onPress={() => guardedBack()} style={{ alignSelf: 'center', marginTop: 20 }}>
          <Text style={{ color: COLORS.primary.deepRed }}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => guardedBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{portfolio.title}</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Image Carousel */}
        <View style={styles.imageContainer}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={(e) => {
              const slide = Math.ceil(e.nativeEvent.contentOffset.x / e.nativeEvent.layoutMeasurement.width);
              if (slide !== activeImage) setActiveImage(slide);
            }}
            scrollEventThrottle={16}
          >
            {portfolio.images && portfolio.images.map((img, index) => (
              <Image
                key={index}
                source={{ uri: img }}
                style={styles.mainImage}
                resizeMode="cover"
              />
            ))}
          </ScrollView>
          
          {/* Pagination Dots */}
          {portfolio.images && portfolio.images.length > 1 && (
            <View style={styles.pagination}>
              {portfolio.images.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.paginationDot,
                    index === activeImage && styles.paginationDotActive
                  ]}
                />
              ))}
            </View>
          )}
        </View>

        <View style={styles.contentContainer}>
          {/* Title & Actions */}
          <View style={styles.titleRow}>
            <Text style={styles.title}>{portfolio.title}</Text>
            <View style={styles.actionButtons}>
              <TouchableOpacity 
                style={[
                    styles.actionButton, 
                    isLiked && styles.actionButtonActive,
                    isSubmitting && { opacity: 0.6 }
                ]}
                onPress={handleLike}
                activeOpacity={0.7}
                disabled={isSubmitting}
              >
                <Ionicons 
                  name={isLiked ? "heart" : "heart-outline"} 
                  size={26} 
                  color={isLiked ? COLORS.primary.deepRed : COLORS.text.primary} 
                />
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.actionButton, isSaved && styles.actionButtonSaved]}
                onPress={handleSave}
                activeOpacity={0.7}
              >
                <Ionicons 
                  name={isSaved ? "bookmark" : "bookmark-outline"} 
                  size={26} 
                  color={isSaved ? COLORS.primary.forestGreen : COLORS.text.primary} 
                />
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={handleShare}
                hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
              >
                <Ionicons name="share-social-outline" size={26} color={COLORS.text.primary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Category Badge */}
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>
              {portfolio.category.charAt(0).toUpperCase() + portfolio.category.slice(1)}
            </Text>
          </View>

          {/* Artist Section */}
          <View style={styles.artistSection}>
            <View style={[styles.artistAvatar, { backgroundColor: getArtistColor(portfolio.artistId) }]}>
              <Text style={styles.artistInitials}>
                {portfolio.artistEmail?.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View>
              <Text style={styles.artistLabel}>Created by</Text>
              <Text style={styles.artistName}>
                {portfolio.artistEmail?.split('@')[0] || 'Unknown Artist'}
              </Text>
            </View>
          </View>

          {/* Stats Row */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Ionicons name="heart" size={20} color={COLORS.primary.deepRed || "#E91E63"} />
              <Text style={styles.statValue}>
                {Math.max(0, portfolio.likes)}
              </Text>
              <Text style={styles.statLabel}>Likes</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Ionicons name="eye" size={20} color={COLORS.text.secondary} />
              <Text style={styles.statValue}>{portfolio.views}</Text>
              <Text style={styles.statLabel}>Views</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Ionicons name="time-outline" size={20} color={COLORS.text.secondary} />
              <Text style={styles.statValue}>
                {new Date(portfolio.createdAt?.toDate()).toLocaleDateString()}
              </Text>
              <Text style={styles.statLabel}>Date</Text>
            </View>
          </View>

          {/* Description */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About this piece</Text>
            <Text style={styles.description}>{portfolio.description}</Text>
          </View>

          {/* Tags */}
          {portfolio.tags && portfolio.tags.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Tags</Text>
              <View style={styles.tagsContainer}>
                {portfolio.tags.map((tag, index) => (
                  <View key={index} style={styles.tag}>
                    <Text style={styles.tagText}>#{tag}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Bottom Action Bar */}
      <View style={styles.actionBar}>
        <TouchableOpacity
          style={styles.chatButton}
          onPress={handleContact}
        >
          <Ionicons name="chatbubble-outline" size={20} color="#fff" />
          <Text style={styles.chatButtonText}>Chat with Artist</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background.primary,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.background.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.light,
    backgroundColor: COLORS.background.primary,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: COLORS.border.light,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text.primary,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
    letterSpacing: 0.1,
  },
  imageContainer: {
    width: SCREEN_WIDTH,
    height: 400,
    position: 'relative',
    backgroundColor: COLORS.background.secondary,
  },
  mainImage: {
    width: SCREEN_WIDTH,
    height: 400,
  },
  pagination: {
    position: 'absolute',
    bottom: 16,
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'center',
    gap: 8,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  paginationDotActive: {
    backgroundColor: '#fff',
    width: 20,
  },
  contentContainer: {
    padding: 20,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text.primary,
    flex: 1,
    lineHeight: 34,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border.light,
    borderRadius: 10,
    backgroundColor: '#fff',
  },
  actionButtonActive: {
    backgroundColor: COLORS.ui.showcaseSection,
    borderColor: COLORS.primary.deepRed,
  },
  actionButtonSaved: {
    backgroundColor: COLORS.ui.eventsBoard,
    borderColor: COLORS.primary.forestGreen,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.ui.showcaseSection,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    marginBottom: 20,
  },
  categoryText: {
    fontSize: 13,
    color: COLORS.primary.deepRed,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  artistSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 14,
    backgroundColor: COLORS.background.secondary,
    borderRadius: 16,
    marginBottom: 20,
  },
  artistAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  artistInitials: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
  },
  artistLabel: {
    fontSize: 12,
    color: COLORS.text.muted,
  },
  artistName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 24,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border.light,
    shadowColor: '#2A1005',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 1,
  },
  statItem: {
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.text.muted,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: COLORS.border.light,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    color: COLORS.text.secondary,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    backgroundColor: COLORS.background.secondary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border.light,
  },
  tagText: {
    color: COLORS.primary.deepRed,
    fontSize: 13,
    fontWeight: '600',
  },
  actionBar: {
    flexDirection: 'row',
    padding: 16,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: COLORS.border.light,
    backgroundColor: COLORS.background.primary,
  },
  chatButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: COLORS.primary.forestGreen,
    gap: 8,
    shadowColor: COLORS.primary.forestGreen,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  chatButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
