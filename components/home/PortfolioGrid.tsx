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

interface PortfolioGridProps {
  portfolios: Portfolio[];
  loading: boolean;
  onViewAll: () => void;
  onPressPortfolio: (id: string) => void;
}

export default function PortfolioGrid({
  portfolios,
  loading,
  onViewAll,
  onPressPortfolio,
}: PortfolioGridProps) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Showcase</Text>
        <TouchableOpacity onPress={onViewAll}>
          <Text style={styles.viewAll}>View All</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.showcaseBoard}>
        {loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={COLORS.primary.deepRed} />
            <Text style={styles.loadingText}>Loading…</Text>
          </View>
        ) : portfolios.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons
              name="images-outline"
              size={36}
              color={COLORS.text.muted}
            />
            <Text style={styles.emptyTitle}>No Showcases Yet</Text>
            <Text style={styles.emptySub}>Create your first portfolio</Text>
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
            scrollEnabled
            contentContainerStyle={styles.showcaseList}
          >
            {portfolios.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.showcaseCard}
                onPress={() => onPressPortfolio(item.id)}
              >
                {item.coverImage ? (
                  <Image
                    source={{ uri: item.coverImage }}
                    style={styles.showcaseThumb}
                    resizeMode="cover"
                  />
                ) : (
                  <View
                    style={[styles.showcaseThumb, styles.showcaseThumbEmpty]}
                  />
                )}
                <View style={styles.showcaseInfo}>
                  <View style={styles.showcaseTitleRow}>
                    <Text style={styles.showcaseName} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <View style={styles.showcaseMeta}>
                      <Ionicons
                        name="heart-outline"
                        size={13}
                        color={COLORS.text.muted}
                      />
                      <Text style={styles.showcaseMetaText}>
                        {item.likes || 0}
                      </Text>
                      <Ionicons
                        name="eye-outline"
                        size={13}
                        color={COLORS.text.muted}
                      />
                      <Text style={styles.showcaseMetaText}>
                        {item.views || 0}
                      </Text>
                    </View>
                  </View>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={COLORS.text.muted}
                />
              </TouchableOpacity>
            ))}
          </ScrollView>
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
  showcaseBoard: {
    backgroundColor: COLORS.badge.background,
    borderRadius: 16,
    padding: 12,
    height: 290,
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
  showcaseList: {
    gap: 8,
    paddingBottom: 2,
  },
  showcaseCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.text.white,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border.primary,
  },
  showcaseThumb: {
    width: 54,
    height: 54,
    borderRadius: 12,
    marginRight: 12,
    flexShrink: 0,
  },
  showcaseThumbEmpty: {
    backgroundColor: COLORS.border.primary,
  },
  showcaseInfo: {
    flex: 1,
  },
  showcaseTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  showcaseName: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.text.primary,
    flexShrink: 1,
  },
  showcaseMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    flexShrink: 0,
  },
  showcaseMetaText: {
    fontSize: 12,
    color: COLORS.text.muted,
  },
});
