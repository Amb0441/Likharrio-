import { Ionicons } from "@expo/vector-icons";
import { useGuardedRouter } from "../../utils/navigationGuard";
import {
  addDoc,
  collection,
  serverTimestamp,
} from "firebase/firestore";
import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { db } from "../../lib/firebase";
import COLORS from "../../constants/Colors";
import { useAuth } from "../../contexts/AuthContext";
import type { Listing } from "../../lib/types";
import ArtworkInfo from "./ArtworkInfo";
import ArtworkRating from "./ArtworkRating";
import ArtworkComments from "./ArtworkComments";

export type { Listing };

interface ArtworkDetailsModalProps {
  visible: boolean;
  listing: Listing | null;
  artistName: string;
  isSaved: boolean;
  isLiked?: boolean;
  isGuestMode?: boolean;
  showComments?: boolean;
  onClose: () => void;
  onShare: () => void;
  onToggleSave: () => void;
  onToggleLike?: () => void;
  onContactArtist: () => void;
  onReport: () => void;
  onArtistPress?: () => void;
}

export default function ArtworkDetailsModal({
  visible,
  listing,
  artistName,
  isSaved,
  isLiked = false,
  isGuestMode = false,
  showComments = false,
  onClose,
  onShare,
  onToggleSave,
  onToggleLike,
  onContactArtist,
  onReport,
  onArtistPress,
}: ArtworkDetailsModalProps) {
  const { guardedPush } = useGuardedRouter();
  const { user } = useAuth();

  const [showReportForm, setShowReportForm] =
    useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportDescription, setReportDescription] =
    useState("");
  const [submittingReport, setSubmittingReport] =
    useState(false);

  const handleSubmitReport = async () => {
    if (!reportReason || !listing || !user) return;
    setSubmittingReport(true);
    try {
      await addDoc(collection(db, "reports"), {
        targetId: listing.id,
        targetType: "listing",
        targetTitle: listing.title,
        targetImage:
          listing.imageUrl ||
          listing.images?.[0] ||
          "",
        reason: reportReason,
        description: reportDescription.trim(),
        reportedBy: user.uid,
        status: "pending",
        createdAt: serverTimestamp(),
      });
      Alert.alert(
        "Report Submitted",
        "Thank you for your report. We'll review it shortly."
      );
      setShowReportForm(false);
      setReportReason("");
      setReportDescription("");
    } catch (e) {
      console.error("Failed to submit report:", e);
      Alert.alert(
        "Error",
        "Failed to submit report. Please try again."
      );
    } finally {
      setSubmittingReport(false);
    }
  };

  const REPORT_REASONS = [
    {
      id: "inappropriate",
      label: "Inappropriate Content",
      icon: "alert-circle-outline",
    },
    {
      id: "spam",
      label: "Spam or Misleading",
      icon: "megaphone-outline",
    },
    {
      id: "copyright",
      label: "Copyright Violation",
      icon: "shield-outline",
    },
    {
      id: "harassment",
      label: "Harassment or Hate",
      icon: "ban-outline",
    },
    {
      id: "fake",
      label: "Fake or Scam",
      icon: "warning-outline",
    },
    {
      id: "other",
      label: "Other",
      icon: "ellipsis-horizontal-outline",
    },
  ];

  if (!listing) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView
        style={styles.container}
        edges={["top", "left", "right", "bottom"]}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={onClose}
          >
            <Ionicons
              name="arrow-back"
              size={24}
              color={COLORS.text.primary}
            />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            Artwork Details
          </Text>
          <TouchableOpacity
            style={styles.reportButton}
            onPress={() => setShowReportForm(true)}
          >
            <Ionicons
              name="flag-outline"
              size={22}
              color={COLORS.primary.deepRed}
            />
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={
            Platform.OS === "ios" ? "padding" : undefined
          }
        >
          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}
          >
            <ArtworkInfo
              listing={listing}
              artistName={artistName}
              isSaved={isSaved}
              isLiked={isLiked}
              onToggleSave={onToggleSave}
              onToggleLike={onToggleLike}
              onShare={onShare}
              onArtistPress={onArtistPress}
            />

            <View style={styles.divider} />

            <ArtworkRating
              listing={listing}
              isGuestMode={isGuestMode}
            />

            {showComments && (
              <ArtworkComments
                listing={listing}
                isGuestMode={isGuestMode}
              />
            )}
          </ScrollView>

          {/* Report form overlay */}
          {showReportForm && (
            <View style={styles.reportOverlay}>
              <View style={styles.reportSheet}>
                <View style={styles.reportHeader}>
                  <Text style={styles.reportTitle}>
                    Report Artwork
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      setShowReportForm(false);
                      setReportReason("");
                      setReportDescription("");
                    }}
                  >
                    <Ionicons
                      name="close"
                      size={22}
                      color={COLORS.text.primary}
                    />
                  </TouchableOpacity>
                </View>
                <ScrollView
                  style={styles.reportBody}
                  showsVerticalScrollIndicator={false}
                >
                  <Text style={styles.reportSubtitle}>
                    Select a reason:
                  </Text>
                  {REPORT_REASONS.map((reason) => (
                    <TouchableOpacity
                      key={reason.id}
                      style={[
                        styles.reportReasonBtn,
                        reportReason === reason.id &&
                          styles.reportReasonBtnActive,
                      ]}
                      onPress={() =>
                        setReportReason(reason.id)
                      }
                    >
                      <Ionicons
                        name={reason.icon as any}
                        size={20}
                        color={
                          reportReason === reason.id
                            ? COLORS.primary.deepRed
                            : "#666"
                        }
                      />
                      <Text
                        style={[
                          styles.reportReasonText,
                          reportReason === reason.id &&
                            styles.reportReasonTextActive,
                        ]}
                      >
                        {reason.label}
                      </Text>
                      {reportReason === reason.id && (
                        <Ionicons
                          name="checkmark-circle"
                          size={18}
                          color={COLORS.primary.deepRed}
                        />
                      )}
                    </TouchableOpacity>
                  ))}
                  <Text style={styles.reportDescLabel}>
                    Additional details (optional):
                  </Text>
                  <TextInput
                    style={styles.reportDescInput}
                    placeholder="Provide more information..."
                    value={reportDescription}
                    onChangeText={setReportDescription}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                    placeholderTextColor="#999"
                  />
                  <TouchableOpacity
                    style={[
                      styles.reportSubmitBtn,
                      !reportReason &&
                        styles.reportSubmitBtnDisabled,
                    ]}
                    onPress={handleSubmitReport}
                    disabled={
                      !reportReason || submittingReport
                    }
                  >
                    <Text
                      style={styles.reportSubmitText}
                    >
                      {submittingReport
                        ? "Submitting..."
                        : "Submit Report"}
                    </Text>
                  </TouchableOpacity>
                </ScrollView>
              </View>
            </View>
          )}

          {/* Bottom bar */}
          {isGuestMode ? (
            <View style={styles.bottomBar}>
              <TouchableOpacity
                style={styles.guestSignInBtn}
                onPress={() => {
                  onClose();
                  guardedPush("/(auth)/login");
                }}
              >
                <Ionicons
                  name="log-in-outline"
                  size={18}
                  color={COLORS.text.white}
                />
                <Text style={styles.guestSignInText}>
                  Sign In
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.guestSignUpBtn}
                onPress={() => {
                  onClose();
                  guardedPush("/(auth)/role-selection");
                }}
              >
                <Ionicons
                  name="person-add-outline"
                  size={18}
                  color={COLORS.primary.deepRed}
                />
                <Text style={styles.guestSignUpText}>
                  Sign Up
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.bottomBar}>
              <TouchableOpacity
                style={styles.chatButton}
                onPress={onContactArtist}
              >
                <Ionicons
                  name="chatbubble-outline"
                  size={18}
                  color={COLORS.text.white}
                />
                <Text style={styles.chatButtonText}>
                  Chat with Artist
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background.primary,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.light,
    backgroundColor: COLORS.background.primary,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.text.white,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: COLORS.border.light,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: COLORS.text.primary,
  },
  reportButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.ui.iconBackground,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border.light,
    marginVertical: 0,
    marginTop: 20,
    marginBottom: 20,
    marginHorizontal: 24,
  },
  bottomBar: {
    flexDirection: "row",
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: COLORS.border.light,
    backgroundColor: COLORS.text.white,
  },
  chatButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 17,
    borderRadius: 14,
    backgroundColor: COLORS.primary.deepRed,
    gap: 8,
  },
  chatButtonText: {
    color: COLORS.text.white,
    fontSize: 15,
    fontWeight: "700",
  },
  guestSignInBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 17,
    borderRadius: 14,
    backgroundColor: COLORS.primary.deepRed,
    gap: 8,
  },
  guestSignInText: {
    color: COLORS.text.white,
    fontSize: 15,
    fontWeight: "700",
  },
  guestSignUpBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 17,
    borderRadius: 14,
    backgroundColor: COLORS.text.white,
    borderWidth: 1.5,
    borderColor: COLORS.primary.deepRed,
    gap: 8,
  },
  guestSignUpText: {
    color: COLORS.primary.deepRed,
    fontSize: 15,
    fontWeight: "700",
  },
  reportOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
    zIndex: 100,
  },
  reportSheet: {
    backgroundColor: COLORS.background.primary,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: "80%",
    paddingBottom: 32,
  },
  reportHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.primary,
  },
  reportTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: COLORS.text.primary,
  },
  reportBody: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  reportSubtitle: {
    fontSize: 14,
    color: COLORS.text.muted,
    marginBottom: 12,
  },
  reportReasonBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    backgroundColor: COLORS.text.white,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.border.primary,
    marginBottom: 10,
  },
  reportReasonBtnActive: {
    borderColor: COLORS.primary.deepRed,
    backgroundColor: "#FFF0F0",
  },
  reportReasonText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.text.primary,
  },
  reportReasonTextActive: {
    color: COLORS.primary.deepRed,
  },
  reportDescLabel: {
    fontSize: 14,
    color: COLORS.text.muted,
    marginBottom: 8,
    marginTop: 4,
  },
  reportDescInput: {
    backgroundColor: COLORS.text.white,
    borderRadius: 14,
    padding: 12,
    fontSize: 14,
    color: COLORS.text.primary,
    minHeight: 80,
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: COLORS.border.primary,
  },
  reportSubmitBtn: {
    backgroundColor: COLORS.primary.deepRed,
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    marginBottom: 10,
  },
  reportSubmitBtnDisabled: {
    backgroundColor: "#ccc",
  },
  reportSubmitText: {
    color: COLORS.text.white,
    fontSize: 16,
    fontWeight: "700",
  },
});
