import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import COLORS from "../../constants/Colors";

interface StatCardsProps {
  followers: number;
  likes: number;
  loading: boolean;
}

export default function StatCards({
  followers,
  likes,
  loading,
}: StatCardsProps) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitleSpaced}>Profile Overview</Text>
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <View style={styles.statIconWrap}>
            <Ionicons name="people" size={18} color={COLORS.primary.deepRed} />
          </View>
          <Text style={styles.statValue}>
            {loading ? "—" : followers.toLocaleString()}
          </Text>
          <Text style={styles.statLabel}>Followers</Text>
        </View>
        <View style={styles.statCard}>
          <View style={styles.statIconWrap}>
            <Ionicons name="heart" size={18} color={COLORS.primary.deepRed} />
          </View>
          <Text style={styles.statValue}>
            {loading ? "—" : likes.toLocaleString()}
          </Text>
          <Text style={styles.statLabel}>Likes</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: 20,
    marginTop: 24,
  },
  sectionTitleSpaced: {
    fontSize: 17,
    fontWeight: "800",
    color: COLORS.text.primary,
    marginBottom: 14,
  },
  statsRow: {
    flexDirection: "row",
    gap: 14,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.text.white,
    borderRadius: 16,
    padding: 18,
    alignItems: "flex-start",
    gap: 6,
    borderWidth: 1.5,
    borderColor: COLORS.border.primary,
    shadowColor: COLORS.text.secondary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.ui.iconBackground,
    justifyContent: "center",
    alignItems: "center",
  },
  statValue: {
    fontSize: 26,
    fontWeight: "800",
    color: COLORS.text.primary,
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.text.muted,
    fontWeight: "500",
  },
});
