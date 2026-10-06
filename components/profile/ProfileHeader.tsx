import { Feather } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import COLORS from "../../constants/Colors";
import { useLayoutMode } from "../../hooks/useLayoutMode";

export interface ArtistProfileData {
  uid: string;
  email: string;
  role: string | null;
  artistType?: string;
  verified: boolean;
  createdAt: string;
  name?: string;
  username?: string;
  bio?: string;
  profileImage?: string;
  referralCode?: string;
}

interface ProfileHeaderProps {
  profile: ArtistProfileData | null;
  artistStatus: "unsubmitted" | "pending" | "approved" | "rejected" | null;
  followersCount: number;
  totalLikes: number;
  portfolioCount: number;
  productsCount: number;
  uploadingImage: boolean;
  onPickImage: () => void;
  onNavigateToVerification: () => void;
}

export default function ProfileHeader({
  profile,
  artistStatus,
  followersCount,
  totalLikes,
  portfolioCount,
  productsCount,
  uploadingImage,
  onPickImage,
  onNavigateToVerification,
}: ProfileHeaderProps) {
  const { isWebsite, width } = useLayoutMode();
  const wide = isWebsite && width >= 900;
  const avatarUri =
    profile?.profileImage ||
    `https://ui-avatars.com/api/?name=${profile?.name || profile?.email}&size=120&background=8B1A1A&color=fff`;

  return (
    <View style={[styles.profileSection, wide && styles.profileSectionWide]}>
      <View style={styles.avatarWrap}>
        <Image
          source={{ uri: avatarUri }}
          style={styles.avatar}
        />
        <View style={styles.cameraOverlay}>
          {uploadingImage ? (
            <ActivityIndicator size="small" color={COLORS.text.white} />
          ) : (
            <Feather
              name="camera"
              size={15}
              color={COLORS.text.white}
            />
          )}
        </View>
        {profile?.verified && (
          <View style={styles.verifiedBadge}>
            <Feather
              name="check-circle"
              size={20}
              color={COLORS.primary.deepRed}
            />
          </View>
        )}
      </View>

      <Text style={styles.profileName}>
        {profile?.name ||
          profile?.email?.split("@")[0] ||
          "Artist"}
      </Text>
      <Text style={styles.profileEmail}>
        {profile?.email}
      </Text>

      <View style={styles.typePill}>
        <Text style={styles.typePillText}>
          {profile?.artistType?.toUpperCase() || "ARTIST"}
        </Text>
      </View>

      {artistStatus === "approved" && (
        <View
          style={[
            styles.statusPill,
            { backgroundColor: COLORS.status.success.bg },
          ]}
        >
          <Feather
            name="check-circle"
            size={13}
            color={COLORS.status.success.text}
          />
          <Text
            style={[
              styles.statusPillText,
              { color: COLORS.status.success.text },
            ]}
          >
            Verified Artist
          </Text>
        </View>
      )}
      {artistStatus === "pending" && (
        <View
          style={[
            styles.statusPill,
            { backgroundColor: COLORS.status.info.bg },
          ]}
        >
          <Feather
            name="clock"
            size={13}
            color={COLORS.status.info.text}
          />
          <Text
            style={[
              styles.statusPillText,
              { color: COLORS.status.info.text },
            ]}
          >
            Verification Pending
          </Text>
        </View>
      )}
      {artistStatus === "rejected" && (
        <TouchableOpacity
          style={[
            styles.statusPill,
            { backgroundColor: COLORS.status.error.bg },
          ]}
          onPress={onNavigateToVerification}
        >
          <Feather
            name="x-circle"
            size={13}
            color={COLORS.status.error.text}
          />
          <Text
            style={[
              styles.statusPillText,
              { color: COLORS.status.error.text },
            ]}
          >
            Not Approved — Tap to Resubmit
          </Text>
        </TouchableOpacity>
      )}
      {(artistStatus === "unsubmitted" || !artistStatus) && (
        <TouchableOpacity
          style={[
            styles.statusPill,
            { backgroundColor: COLORS.status.warning.bg },
          ]}
          onPress={onNavigateToVerification}
        >
          <Feather
            name="shield"
            size={13}
            color={COLORS.status.warning.text}
          />
          <Text
            style={[
              styles.statusPillText,
              { color: COLORS.status.warning.text },
            ]}
          >
            Get Verified →
          </Text>
        </TouchableOpacity>
      )}

      <Text style={styles.profileBio}>
        {profile?.bio || "No bio yet. Tap the edit icon to add one."}
      </Text>

      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{followersCount}</Text>
          <Text style={styles.statLabel}>Followers</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{totalLikes}</Text>
          <Text style={styles.statLabel}>Likes</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{portfolioCount}</Text>
          <Text style={styles.statLabel}>Showcases</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{productsCount}</Text>
          <Text style={styles.statLabel}>Products</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  profileSection: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 24,
  },
  profileSectionWide: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 28,
    width: "100%",
    maxWidth: 1100,
    alignSelf: "center",
    backgroundColor: COLORS.text.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border.primary,
    marginTop: 8,
  },
  avatarWrap: {
    position: "relative",
    marginBottom: 16,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    borderColor: COLORS.border.primary,
  },
  cameraOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 30,
    backgroundColor: COLORS.overlay.dark,
    borderBottomLeftRadius: 48,
    borderBottomRightRadius: 48,
    justifyContent: "center",
    alignItems: "center",
  },
  verifiedBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: COLORS.text.white,
    borderRadius: 12,
  },
  profileName: {
    fontSize: 22,
    fontWeight: "800",
    color: COLORS.text.primary,
    marginBottom: 3,
    letterSpacing: -0.3,
  },
  profileEmail: {
    fontSize: 13,
    color: COLORS.text.muted,
    marginBottom: 12,
  },
  typePill: {
    backgroundColor: COLORS.background.tertiary,
    borderWidth: 1,
    borderColor: COLORS.border.secondary,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 10,
  },
  typePillText: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.primary.deepRed,
    letterSpacing: 1,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 10,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: "700",
  },
  profileBio: {
    fontSize: 14,
    color: COLORS.text.dark,
    textAlign: "center",
    lineHeight: 20,
    marginTop: 4,
    marginBottom: 20,
    paddingHorizontal: 16,
    fontStyle: "italic",
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    backgroundColor: COLORS.text.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border.primary,
    paddingVertical: 16,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.text.primary,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    color: COLORS.text.muted,
    fontWeight: "500",
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: COLORS.border.primary,
  },
});
