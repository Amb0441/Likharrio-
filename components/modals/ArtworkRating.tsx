import { Ionicons } from "@expo/vector-icons";
import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { db } from "../../lib/firebase";
import COLORS from "../../constants/Colors";
import { useAuth } from "../../contexts/AuthContext";
import type { Listing } from "../../lib/types";

interface ArtworkRatingProps {
  listing: Listing;
  isGuestMode: boolean;
}

export default function ArtworkRating({
  listing,
  isGuestMode,
}: ArtworkRatingProps) {
  const { user } = useAuth();
  const [userRating, setUserRating] = useState(0);
  const [averageRating, setAverageRating] = useState(0);
  const [totalRatings, setTotalRatings] = useState(0);
  const [submittingRating, setSubmittingRating] =
    useState(false);

  useEffect(() => {
    const ratingsQuery = query(
      collection(db, "listings", listing.id, "ratings")
    );
    const unsubscribe = onSnapshot(
      ratingsQuery,
      (snapshot) => {
        const ratings = snapshot.docs.map((d) => ({
          userId: d.data().userId,
          rating: d.data().rating as number,
        }));
        const total = ratings.reduce(
          (s, r) => s + r.rating,
          0
        );
        setAverageRating(
          ratings.length > 0 ? total / ratings.length : 0
        );
        setTotalRatings(ratings.length);
        if (user) {
          const myRating = ratings.find(
            (r) => r.userId === user.uid
          );
          setUserRating(myRating ? myRating.rating : 0);
        }
      }
    );
    return () => unsubscribe();
  }, [listing.id, user]);

  const handleRate = async (rating: number) => {
    if (!user || isGuestMode) {
      Alert.alert(
        "Sign In Required",
        "Please sign in to rate artworks"
      );
      return;
    }
    if (submittingRating) return;
    setSubmittingRating(true);
    setUserRating(rating);
    try {
      const ratingId = `${user.uid}`;
      await setDoc(
        doc(
          db,
          "listings",
          listing.id,
          "ratings",
          ratingId
        ),
        {
          userId: user.uid,
          rating,
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (e) {
      console.error("Failed to submit rating:", e);
      setUserRating(0);
      Alert.alert("Error", "Failed to submit rating.");
    } finally {
      setSubmittingRating(false);
    }
  };

  return (
    <View style={styles.ratingSection}>
      <View style={styles.ratingHeader}>
        <Ionicons
          name="star"
          size={18}
          color={COLORS.secondary.goldenYellow}
        />
        <Text style={styles.ratingTitle}>Rating</Text>
        {totalRatings > 0 && (
          <Text style={styles.ratingAverage}>
            {averageRating.toFixed(1)} ({totalRatings})
          </Text>
        )}
      </View>
      <View style={styles.starsRow}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity
            key={star}
            onPress={() => handleRate(star)}
            activeOpacity={0.7}
            disabled={submittingRating}
          >
            <Ionicons
              name={
                star <= userRating
                  ? "star"
                  : "star-outline"
              }
              size={28}
              color={
                star <= userRating
                  ? COLORS.secondary.goldenYellow
                  : COLORS.border.light
              }
            />
          </TouchableOpacity>
        ))}
        {totalRatings === 0 && (
          <Text style={styles.ratingPrompt}>
            Be the first to rate
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ratingSection: {
    marginBottom: 8,
  },
  ratingHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  ratingTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.text.primary,
  },
  ratingAverage: {
    fontSize: 13,
    color: COLORS.text.secondary,
    fontWeight: "600",
  },
  starsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  ratingPrompt: {
    fontSize: 12,
    color: COLORS.text.muted,
    marginLeft: 8,
  },
});
