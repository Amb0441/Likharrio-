import { Ionicons } from "@expo/vector-icons";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import COLORS from "../../constants/Colors";
import { Artist } from "../../lib/types";
import { getAvatarColor } from "../../lib/helpers";
import LoadingIndicator from "../ui/LoadingIndicator";
import EmptyState from "../ui/EmptyState";

interface ArtistSectionProps {
  artists: Artist[];
  loading: boolean;
  followingIds: string[];
  onViewAll: () => void;
  onPressArtist: (id: string) => void;
  onFollow: (id: string, name: string) => void;
  onLongPress?: (id: string, name: string) => void;
}

export default function ArtistSection({
  artists,
  loading,
  followingIds,
  onViewAll,
  onPressArtist,
  onFollow,
  onLongPress,
}: ArtistSectionProps) {
  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.title}>Artists You May Like</Text>
        <TouchableOpacity onPress={onViewAll}>
          <Text style={styles.viewAll}>View All</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        {loading ? (
          <LoadingIndicator />
        ) : artists.length === 0 ? (
          <EmptyState icon="people-outline" title="No artists found" />
        ) : (
          <View style={styles.list}>
            {artists.map((artist) => (
              <TouchableOpacity
                key={artist.id}
                style={styles.row}
                onPress={() => onPressArtist(artist.id)}
                onLongPress={(e) => {
                  e.stopPropagation();
                  onLongPress?.(artist.id, artist.displayName);
                }}
              >
                {artist.profileImage ? (
                  <Image
                    source={{ uri: artist.profileImage }}
                    style={styles.avatar}
                    resizeMode="cover"
                  />
                ) : (
                  <View
                    style={[
                      styles.avatar,
                      { backgroundColor: getAvatarColor(artist.displayName) },
                    ]}
                  >
                    <Text style={styles.avatarText}>
                      {(artist.displayName || "?").charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}

                <View style={styles.info}>
                  <Text style={styles.name}>{artist.displayName}</Text>
                  <Text style={styles.role}>{artist.role}</Text>
                </View>

                {followingIds.includes(artist.id) ? (
                  <View style={styles.followedBadge}>
                    <Ionicons name="checkmark" size={14} color="#fff" />
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.followBtn}
                    onPress={() => onFollow(artist.id, artist.displayName)}
                  >
                    <Ionicons
                      name="add"
                      size={18}
                      color={COLORS.primary.deepRed}
                    />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: 20,
    marginTop: 24,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  title: {
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
  card: {
    backgroundColor: COLORS.text.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: COLORS.border.primary,
  },
  list: {
    gap: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
    overflow: "hidden",
  },
  avatarText: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.text.white,
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.text.primary,
  },
  role: {
    fontSize: 11,
    color: COLORS.text.muted,
    marginTop: 2,
  },
  followBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: COLORS.ui.iconBackground,
    justifyContent: "center",
    alignItems: "center",
  },
  followedBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: COLORS.primary.forestGreen,
    justifyContent: "center",
    alignItems: "center",
  },
});
