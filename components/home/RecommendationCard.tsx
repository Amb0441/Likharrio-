import { Ionicons } from "@expo/vector-icons";
import { doc, getDoc } from "firebase/firestore";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { db } from "../../lib/firebase";
import COLORS from "../../constants/Colors";
import { useAuth } from "../../contexts/AuthContext";
import { Listing } from "../../lib/types";
import { RecommendedArtwork } from "../../utils/recommendations/recommendationEngine";

interface RecommendationCardProps {
  rec: RecommendedArtwork;
  onPress: (listing: Listing, artistName: string) => void;
  onLongPress: (id: string, title: string, type: "listing" | "artwork") => void;
}

export default function RecommendationCard({
  rec,
  onPress,
  onLongPress,
}: RecommendationCardProps) {
  const { user } = useAuth();

  const handlePress = async () => {
    if (rec.type === "portfolio") {
      onPress(
        {
          id: rec.id,
          title: rec.title,
          description: "",
          category: "",
          price: 0,
          imageUrl: rec.imageUrl,
          artistId: "",
          artistEmail: "",
        },
        rec.artistName,
      );
      return;
    }

    try {
      const listingDoc = await getDoc(doc(db, "listings", rec.id));
      if (!listingDoc.exists()) return;
      const d = listingDoc.data();
      const artwork: Listing = {
        id: listingDoc.id,
        title: d.title || "",
        description: d.description || "",
        category: d.category || "",
        price: d.price || 0,
        imageUrl: d.imageUrl,
        images: d.images || [],
        saves: d.saves || 0,
        views: d.views || 0,
        artistId: d.artistId || "",
        artistEmail: d.artistEmail || "",
        status: d.status || "available",
        createdAt: d.createdAt,
      };
      onPress(artwork, rec.artistName);
    } catch (e) {
      console.error("Error loading listing:", e);
    }
  };

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={handlePress}
      onLongPress={(e) => {
        e.stopPropagation();
        onLongPress(
          rec.id,
          rec.title,
          rec.type === "listing" ? "listing" : "artwork",
        );
      }}
    >
      <Image
        source={{ uri: rec.imageUrl || "https://via.placeholder.com/300x200" }}
        style={styles.image}
      />
      {rec.type === "listing" && (rec.price ?? 0) > 0 && (
        <View style={styles.priceBadge}>
          <Text style={styles.priceText}>₱{(rec.price ?? 0).toLocaleString()}</Text>
        </View>
      )}
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>
          {rec.title}
        </Text>
        <Text style={styles.artist} numberOfLines={1}>
          {rec.artistName}
        </Text>
        <View style={styles.reason}>
          <Ionicons name="trending-up" size={10} color={COLORS.primary.deepRed} />
          <Text style={styles.reasonText} numberOfLines={1}>
            {rec.reason}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 200,
    backgroundColor: COLORS.text.white,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: COLORS.border.primary,
  },
  image: {
    width: "100%",
    height: 148,
    backgroundColor: COLORS.border.primary,
  },
  priceBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.72)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  priceText: {
    color: COLORS.text.white,
    fontSize: 11,
    fontWeight: "600",
  },
  info: {
    padding: 12,
    gap: 4,
  },
  title: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.text.primary,
  },
  artist: {
    fontSize: 11,
    color: COLORS.text.muted,
  },
  reason: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FAF0E8",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  reasonText: {
    fontSize: 10,
    color: COLORS.primary.deepRed,
    fontWeight: "500",
  },
});
