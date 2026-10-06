import { Ionicons } from "@expo/vector-icons";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  Dimensions,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { db } from "../../lib/firebase";
import COLORS from "../../constants/Colors";
import type { Listing } from "../../lib/types";

const {
  width: SCREEN_WIDTH,
  height: SCREEN_HEIGHT,
} = Dimensions.get("window");

interface ArtworkInfoProps {
  listing: Listing;
  artistName: string;
  isSaved: boolean;
  isLiked: boolean;
  onToggleSave: () => void;
  onToggleLike?: () => void;
  onShare: () => void;
  onArtistPress?: () => void;
}

export default function ArtworkInfo({
  listing,
  artistName,
  isSaved,
  isLiked,
  onToggleSave,
  onToggleLike,
  onShare,
  onArtistPress,
}: ArtworkInfoProps) {
  const [activeSlide, setActiveSlide] = useState(0);
  const [fullScreenImage, setFullScreenImage] =
    useState(false);
  const [artistProfileImage, setArtistProfileImage] =
    useState<string | null>(null);

  useEffect(() => {
    if (!listing?.artistId) {
      setArtistProfileImage(null);
      return;
    }
    const fetchArtistImage = async () => {
      try {
        const userDoc = await getDoc(
          doc(db, "users", listing.artistId)
        );
        if (userDoc.exists()) {
          const d = userDoc.data();
          setArtistProfileImage(d.profileImage || null);
        }
      } catch (e) {
        console.error("Failed to fetch artist image:", e);
      }
    };
    fetchArtistImage();
  }, [listing?.artistId]);

  const images =
    listing.images && listing.images.length > 0
      ? listing.images
      : listing.imageUrl
        ? [listing.imageUrl]
        : [];

  return (
    <>
      {/* Image carousel */}
      <View style={styles.carouselContainer}>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={({ nativeEvent }) => {
            const slide = Math.ceil(
              nativeEvent.contentOffset.x /
                nativeEvent.layoutMeasurement.width
            );
            setActiveSlide(slide);
          }}
          scrollEventThrottle={16}
        >
          {images.length > 0 ? (
            images.map((img, index) => (
              <TouchableOpacity
                key={index}
                activeOpacity={0.9}
                onPress={() => setFullScreenImage(true)}
                style={{
                  width: SCREEN_WIDTH,
                  height: SCREEN_WIDTH,
                }}
              >
                <Image
                  source={{ uri: img }}
                  style={styles.carouselImage}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.imagePlaceholder}>
              <Ionicons
                name="image-outline"
                size={64}
                color="#999"
              />
            </View>
          )}
        </ScrollView>

        {/* Pagination dots */}
        {images.length > 1 && (
          <View style={styles.pagination}>
            {images.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.paginationDot,
                  index === activeSlide &&
                    styles.paginationDotActive,
                ]}
              />
            ))}
          </View>
        )}
      </View>

      {/* Details */}
      <View style={styles.details}>
        {/* Title + actions */}
        <View style={styles.titleRow}>
          <Text style={styles.listingTitle}>
            {listing.title}
          </Text>
          <View style={styles.actionButtons}>
            {onToggleLike && (
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  isLiked && styles.actionButtonLiked,
                ]}
                onPress={onToggleLike}
              >
                <Ionicons
                  name={isLiked ? "heart" : "heart-outline"}
                  size={20}
                  color={
                    isLiked
                      ? COLORS.primary.deepRed
                      : COLORS.text.primary
                  }
                />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.actionButton}
              onPress={onShare}
            >
              <Ionicons
                name="share-social-outline"
                size={20}
                color={COLORS.text.primary}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.actionButton,
                isSaved && styles.actionButtonSaved,
              ]}
              onPress={onToggleSave}
            >
              <Ionicons
                name={
                  isSaved ? "bookmark" : "bookmark-outline"
                }
                size={20}
                color={
                  isSaved
                    ? COLORS.primary.deepRed
                    : COLORS.text.primary
                }
              />
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.price}>
          ₱ {listing.price.toLocaleString()}
        </Text>

        {/* Artist row */}
        <TouchableOpacity
          style={styles.artistRow}
          onPress={onArtistPress}
          activeOpacity={onArtistPress ? 0.7 : 1}
          disabled={!onArtistPress}
        >
          {artistProfileImage ? (
            <Image
              source={{ uri: artistProfileImage }}
              style={styles.artistAvatar}
              resizeMode="cover"
            />
          ) : (
            <View
              style={[
                styles.artistAvatar,
                styles.artistAvatarFallback,
              ]}
            >
              <Text style={styles.artistAvatarInitial}>
                {artistName
                  ? artistName.charAt(0).toUpperCase()
                  : "?"}
              </Text>
            </View>
          )}
          <View>
            <Text style={styles.artistLabel}>
              Listed by
            </Text>
            <Text style={styles.artistName}>
              {artistName}
            </Text>
          </View>
        </TouchableOpacity>

        <View style={styles.divider} />

        <Text style={styles.description}>
          {listing.description || "No description"}
        </Text>
      </View>

      {/* Fullscreen image modal */}
      <Modal
        visible={fullScreenImage}
        transparent
        animationType="fade"
        onRequestClose={() => setFullScreenImage(false)}
      >
        <View style={styles.fullscreenContainer}>
          <TouchableOpacity
            style={styles.fullscreenClose}
            onPress={() => setFullScreenImage(false)}
          >
            <Ionicons
              name="close"
              size={28}
              color={COLORS.text.white}
            />
          </TouchableOpacity>
          {images[activeSlide] && (
            <Image
              source={{ uri: images[activeSlide] }}
              style={styles.fullscreenImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  carouselContainer: {
    height: SCREEN_WIDTH,
    position: "relative",
  },
  carouselImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH,
  },
  imagePlaceholder: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.background.secondary,
  },
  pagination: {
    position: "absolute",
    bottom: 16,
    width: "100%",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(0,0,0,0.3)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.5)",
  },
  paginationDotActive: {
    width: 24,
    backgroundColor: COLORS.primary.deepRed,
    borderColor: "transparent",
  },
  details: {
    padding: 24,
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 8,
  },
  listingTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: COLORS.text.primary,
    flex: 1,
  },
  actionButtons: {
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    padding: 8,
    borderWidth: 1,
    borderColor: COLORS.border.light,
    borderRadius: 10,
    backgroundColor: COLORS.text.white,
  },
  actionButtonSaved: {
    backgroundColor: COLORS.ui.iconBackground,
    borderColor: COLORS.primary.deepRed,
  },
  actionButtonLiked: {
    backgroundColor: COLORS.ui.iconBackground,
    borderColor: COLORS.primary.deepRed,
  },
  price: {
    fontSize: 26,
    fontWeight: "800",
    color: COLORS.text.primary,
    marginBottom: 16,
  },
  artistRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
  },
  artistAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    overflow: "hidden",
  },
  artistAvatarFallback: {
    backgroundColor: COLORS.background.secondary,
    justifyContent: "center",
    alignItems: "center",
  },
  artistAvatarInitial: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text.secondary,
  },
  artistLabel: {
    fontSize: 12,
    color: COLORS.text.muted,
  },
  artistName: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.text.primary,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border.light,
    marginVertical: 20,
  },
  description: {
    fontSize: 15,
    color: COLORS.text.secondary,
    lineHeight: 22,
  },
  fullscreenContainer: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },
  fullscreenClose: {
    position: "absolute",
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 8,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 20,
  },
  fullscreenImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
});
