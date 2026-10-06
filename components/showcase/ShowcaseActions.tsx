import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import COLORS from "../../constants/Colors";
import { showGuestAlert } from "../../lib/helpers";

interface ShowcaseActionsProps {
  isLiked: boolean;
  isSaved: boolean;
  isSubmitting: boolean;
  isOwner: boolean;
  isGuestMode: boolean;
  likes: number;
  views: number;
  guardedPush: (route: any) => void;
  onLike: () => void;
  onSave: () => void;
  onShare: () => void;
  onReport: () => void;
}

export default function ShowcaseActions({
  isLiked,
  isSaved,
  isSubmitting,
  isOwner,
  isGuestMode,
  likes,
  views,
  guardedPush,
  onLike,
  onSave,
  onShare,
  onReport,
}: ShowcaseActionsProps) {
  const handleLike = () => {
    if (isGuestMode) {
      showGuestAlert(guardedPush, "like artworks");
      return;
    }
    onLike();
  };

  const handleSave = () => {
    if (isGuestMode) {
      showGuestAlert(guardedPush, "save artworks");
      return;
    }
    onSave();
  };

  const handleReport = () => {
    if (isGuestMode) {
      showGuestAlert(guardedPush, "report content");
      return;
    }
    onReport();
  };

  return (
    <View style={styles.actionButtons}>
      {isOwner ? (
        <TouchableOpacity
          style={styles.actionButton}
          onPress={onShare}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons
            name="share-social-outline"
            size={22}
            color="#4A3829"
          />
        </TouchableOpacity>
      ) : (
        <>
          <TouchableOpacity
            style={[
              styles.actionButton,
              isLiked && styles.actionButtonActive,
              isSubmitting && styles.submitting,
            ]}
            onPress={handleLike}
            activeOpacity={0.7}
            disabled={isSubmitting}
          >
            <Ionicons
              name={isLiked ? "heart" : "heart-outline"}
              size={22}
              color={
                isLiked
                  ? COLORS.primary.deepRed
                  : "#4A3829"
              }
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.actionButton,
              isSaved && styles.actionButtonSaved,
            ]}
            onPress={handleSave}
            activeOpacity={0.7}
          >
            <Ionicons
              name={isSaved ? "bookmark" : "bookmark-outline"}
              size={22}
              color={
                isSaved
                  ? COLORS.primary.forestGreen
                  : "#4A3829"
              }
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={onShare}
            hitSlop={{
              top: 10,
              bottom: 10,
              left: 10,
              right: 10,
            }}
          >
            <Ionicons
              name="share-social-outline"
              size={22}
              color="#4A3829"
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleReport}
            hitSlop={{
              top: 10,
              bottom: 10,
              left: 10,
              right: 10,
            }}
          >
            <Ionicons
              name="flag-outline"
              size={22}
              color="#4A3829"
            />
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  actionButtons: {
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border.primary,
    backgroundColor: COLORS.text.white,
    alignItems: "center",
    justifyContent: "center",
  },
  actionButtonActive: {
    backgroundColor: "#FEF1EB",
    borderColor: COLORS.primary.deepRed,
  },
  actionButtonSaved: {
    backgroundColor: COLORS.ui.eventsBoard,
    borderColor: COLORS.primary.forestGreen,
  },
  submitting: {
    opacity: 0.6,
  },

});
