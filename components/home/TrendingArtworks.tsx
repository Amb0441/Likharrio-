import { Ionicons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import COLORS from "../../constants/Colors";
import { Portfolio } from "../../lib/types";

interface TrendingArtworksProps {
  artworks: Portfolio[];
  loading: boolean;
  onViewAll: () => void;
  onPressArtwork: (id: string) => void;
}

export default function TrendingArtworks({
  artworks,
  loading,
  onViewAll,
  onPressArtwork,
}: TrendingArtworksProps) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Discover Artworks</Text>
        <TouchableOpacity onPress={onViewAll}>
          <Text style={styles.viewAll}>Explore</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={COLORS.primary.deepRed} />
          <Text style={styles.loadingText}>Loading…</Text>
        </View>
      ) : artworks.length === 0 ? (
        <View style={styles.emptyBox}>
          <Ionicons
            name="images-outline"
            size={36}
            color={COLORS.text.muted}
          />
          <Text style={styles.emptyTitle}>No artworks yet</Text>
          <Text style={styles.emptySub}>Check back soon!</Text>
        </View>
      ) : (
        <View style={styles.trendingBoard}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.trendingList}
          >
            {artworks.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.trendingCard}
                onPress={() => onPressArtwork(item.id)}
              >
                {item.coverImage ? (
                  <Image
                    source={{ uri: item.coverImage }}
                    style={styles.trendingThumb}
                    resizeMode="cover"
                  />
                ) : (
                  <View
                    style={[styles.trendingThumb, styles.trendingThumbEmpty]}
                  />
                )}
                <View style={styles.trendingInfo}>
                  <Text style={styles.trendingTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <View style={styles.trendingMeta}>
                    <Ionicons
                      name="heart-outline"
                      size={11}
                      color={COLORS.text.muted}
                    />
                    <Text style={styles.trendingMetaText}>
                      {item.likes || 0}
                    </Text>
                    <Ionicons
                      name="eye-outline"
                      size={11}
                      color={COLORS.text.muted}
                    />
                    <Text style={styles.trendingMetaText}>
                      {item.views || 0}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
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
  },
  viewAll: {
    fontSize: 13,
    color: COLORS.primary.deepRed,
    fontWeight: "600",
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    color: COLORS.text.muted,
  },
  emptyBox: {
    alignItems: "center",
    padding: 28,
    gap: 6,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.text.secondary,
  },
  emptySub: {
    fontSize: 12,
    color: COLORS.text.muted,
    textAlign: "center",
  },
  trendingBoard: {
    backgroundColor: COLORS.text.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: COLORS.border.primary,
  },
  trendingList: {
    gap: 12,
    paddingRight: 4,
  },
  trendingCard: {
    width: 150,
    backgroundColor: COLORS.text.white,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: COLORS.border.primary,
    shadowColor: COLORS.text.secondary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  trendingThumb: {
    width: "100%",
    height: 120,
  },
  trendingThumbEmpty: {
    backgroundColor: COLORS.border.primary,
  },
  trendingInfo: {
    padding: 10,
    gap: 4,
  },
  trendingTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.text.primary,
  },
  trendingMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  trendingMetaText: {
    fontSize: 11,
    color: COLORS.text.muted,
  },
});
