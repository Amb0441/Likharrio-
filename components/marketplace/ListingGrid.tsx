import { Ionicons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import COLORS from "../../constants/Colors";
import type { Listing, ArtistProfile } from "../../lib/types";
import { useLayoutMode } from "../../hooks/useLayoutMode";

interface ListingCardProps {
  listing: Listing;
  isSaved: boolean;
  isLiked: boolean;
  onPress: (l: Listing) => void;
  onToggleSave: (l: Listing, e?: any) => void;
  onToggleLike: (l: Listing, e?: any) => void;
  artistProfile?: ArtistProfile;
}

const ListingCard = ({
  listing,
  isSaved,
  isLiked,
  onPress,
  onToggleSave,
  onToggleLike,
  artistProfile,
}: ListingCardProps) => (
  <TouchableOpacity
    style={styles.card}
    onPress={() => onPress(listing)}
    activeOpacity={0.75}
  >
    <View style={styles.cardImageWrap}>
      {listing.imageUrl ? (
        <Image
          source={{ uri: listing.imageUrl }}
          style={styles.cardImage}
          resizeMode="cover"
        />
      ) : (
        <View style={styles.cardImagePlaceholder}>
          <Ionicons
            name="image-outline"
            size={28}
            color={COLORS.text.muted}
          />
        </View>
      )}

      {listing.status === "sold" && (
        <View style={styles.soldOverlay}>
          <Text style={styles.soldText}>SOLD</Text>
        </View>
      )}

      <View style={styles.cardBadgeRow}>
        <TouchableOpacity
          style={[
            styles.cardBadgeBtn,
            isLiked && styles.cardBadgeBtnActive,
          ]}
          onPress={(e) => onToggleLike(listing, e)}
          activeOpacity={0.8}
        >
          <Ionicons
            name={isLiked ? "heart" : "heart-outline"}
            size={14}
            color={
              isLiked
                ? COLORS.primary.deepRed
                : COLORS.text.white
            }
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.cardBadgeBtn}
          onPress={(e) => onToggleSave(listing, e)}
          activeOpacity={0.8}
        >
          <Ionicons
            name={isSaved ? "bookmark" : "bookmark-outline"}
            size={14}
            color={
              isSaved
                ? COLORS.secondary.goldenYellow
                : COLORS.text.white
            }
          />
        </TouchableOpacity>
      </View>
    </View>

    <View style={styles.cardInfo}>
      <Text style={styles.cardTitle} numberOfLines={1}>
        {listing.title}
      </Text>
      <Text style={styles.cardCategory} numberOfLines={1}>
        {listing.category}
      </Text>

      {artistProfile && (
        <View style={styles.cardArtistRow}>
          {artistProfile.profileImage ? (
            <Image
              source={{ uri: artistProfile.profileImage }}
              style={styles.cardAvatar}
            />
          ) : (
            <View
              style={[
                styles.cardAvatar,
                styles.cardAvatarFallback,
              ]}
            >
              <Text style={styles.cardAvatarText}>
                {(artistProfile.displayName || "?")
                  .charAt(0)
                  .toUpperCase()}
              </Text>
            </View>
          )}
          <Text
            style={styles.cardArtistName}
            numberOfLines={1}
          >
            {artistProfile.displayName}
          </Text>
        </View>
      )}
    </View>
  </TouchableOpacity>
);

interface ListingGridProps {
  listings: Listing[];
  loading: boolean;
  userSaves: Set<string>;
  userLikes: Set<string>;
  onListingPress: (listing: Listing) => void;
  onToggleSave: (listing: Listing, e?: any) => void;
  onToggleLike: (listing: Listing, e?: any) => void;
  artistProfiles: Record<string, ArtistProfile>;
}

export default function ListingGrid({
  listings,
  loading,
  userSaves,
  userLikes,
  onListingPress,
  onToggleSave,
  onToggleLike,
  artistProfiles,
}: ListingGridProps) {
  const { isWebsite, width } = useLayoutMode();
  const columns = !isWebsite ? 2 : width >= 1100 ? 4 : 3;
  const columnWidth = `${100 / columns}%`;

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator
          size="large"
          color={COLORS.primary.deepRed}
        />
        <Text style={styles.loadingText}>Loading artwork…</Text>
      </View>
    );
  }

  if (listings.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        <Ionicons
          name="cube-outline"
          size={40}
          color={COLORS.text.muted}
        />
        <Text style={styles.emptyTitle}>No listings found</Text>
        <Text style={styles.emptySub}>
          Try a different search or category
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.grid}>
      {listings.map((listing) => (
        <View key={listing.id} style={{ width: columnWidth, padding: 6 }}>
          <ListingCard
            listing={listing}
            isSaved={userSaves.has(listing.id)}
            isLiked={userLikes.has(listing.id)}
            onPress={onListingPress}
            onToggleSave={onToggleSave}
            onToggleLike={onToggleLike}
            artistProfile={artistProfiles[listing.artistId]}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -6,
  },
  loadingWrap: {
    paddingVertical: 80,
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: COLORS.text.secondary,
  },
  emptyWrap: {
    paddingVertical: 60,
    alignItems: "center",
    gap: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.text.primary,
  },
  emptySub: {
    fontSize: 12,
    color: COLORS.text.secondary,
    textAlign: "center",
  },
  card: {
    width: "100%",
    backgroundColor: COLORS.text.white,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: COLORS.border.primary,
    shadowColor: COLORS.text.primary,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  cardImageWrap: {
    width: "100%",
    aspectRatio: 1,
    position: "relative",
  },
  cardImage: {
    width: "100%",
    height: "100%",
  },
  cardImagePlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: COLORS.badge.background,
    justifyContent: "center",
    alignItems: "center",
  },
  soldOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.overlay.dark,
    justifyContent: "center",
    alignItems: "center",
  },
  soldText: {
    color: COLORS.text.white,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 2,
  },
  cardBadgeRow: {
    position: "absolute",
    top: 8,
    right: 8,
    flexDirection: "row",
    gap: 6,
  },
  cardBadgeBtn: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: COLORS.overlay.medium,
    justifyContent: "center",
    alignItems: "center",
  },
  cardBadgeBtnActive: {
    backgroundColor: COLORS.overlay.dark,
  },
  cardInfo: {
    padding: 10,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.text.primary,
    marginBottom: 3,
  },
  cardCategory: {
    fontSize: 11,
    color: COLORS.text.secondary,
    marginBottom: 6,
  },
  cardArtistRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  cardAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  cardAvatarFallback: {
    backgroundColor: COLORS.primary.deepRed,
    justifyContent: "center",
    alignItems: "center",
  },
  cardAvatarText: {
    fontSize: 9,
    fontWeight: "800",
    color: COLORS.text.white,
  },
  cardArtistName: {
    fontSize: 11,
    color: COLORS.text.secondary,
    fontWeight: "500",
    flex: 1,
  },
});
