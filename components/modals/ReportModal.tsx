import { Ionicons } from "@expo/vector-icons";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { useState, useRef } from "react";
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
import { db } from "../../lib/firebase";
import COLORS from "../../constants/Colors";

interface ReportModalProps {
  visible: boolean;
  onClose: () => void;
  targetId: string;
  targetType: "listing" | "artist" | "artwork";
  reportedBy: string;
  targetTitle?: string;
  targetImage?: string;
}

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

export default function ReportModal({
  visible,
  onClose,
  targetId,
  targetType,
  reportedBy,
  targetTitle,
  targetImage,
}: ReportModalProps) {
  const [selectedReason, setSelectedReason] = useState<string>("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  const handleSubmit = async () => {
    if (!selectedReason) {
      Alert.alert("Error", "Please select a reason for reporting");
      return;
    }

    try {
      setSubmitting(true);
      await addDoc(collection(db, "reports"), {
        targetId,
        targetType,
        targetTitle: targetTitle || "",
        targetImage: targetImage || "",
        reason: selectedReason,
        description: description.trim(),
        reportedBy,
        status: "pending",
        createdAt: serverTimestamp(),
      });

      Alert.alert(
        "Report Submitted",
        "Thank you for your report. We'll review it shortly.",
      );
      handleClose();
    } catch (error) {
      console.error("Error submitting report:", error);
      Alert.alert("Error", "Failed to submit report. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setSelectedReason("");
    setDescription("");
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Report {targetType}</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "padding"}
            style={{ flex: 1 }}
            keyboardVerticalOffset={Platform.OS === "android" ? 0 : 0}
          >
          <ScrollView
            ref={scrollViewRef}
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.subtitle}>
              Please select a reason for reporting:
            </Text>

            <View style={styles.reasonsContainer}>
              {REPORT_REASONS.map((reason) => (
                <TouchableOpacity
                  key={reason.id}
                  style={[
                    styles.reasonButton,
                    selectedReason === reason.id && styles.reasonButtonSelected,
                  ]}
                  onPress={() => setSelectedReason(reason.id)}
                >
                  <Ionicons
                    name={reason.icon as any}
                    size={24}
                    color={
                      selectedReason === reason.id
                        ? COLORS.primary.deepRed
                        : "#666"
                    }
                  />
                  <Text
                    style={[
                      styles.reasonText,
                      selectedReason === reason.id &&
                        styles.reasonTextSelected,
                    ]}
                  >
                    {reason.label}
                  </Text>
                  {selectedReason === reason.id && (
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color={COLORS.primary.deepRed}
                      style={styles.checkmark}
                    />
                  )}
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.descriptionLabel}>
              Additional details (optional):
            </Text>
            <TextInput
              style={styles.descriptionInput}
              placeholder="Provide more information about this report..."
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              placeholderTextColor="#999"
              onFocus={() => setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 300)}
            />

            <TouchableOpacity
              style={[
                styles.submitButton,
                !selectedReason && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={!selectedReason || submitting}
            >
              <Text style={styles.submitButtonText}>
                {submitting ? "Submitting..." : "Submit Report"}
              </Text>
            </TouchableOpacity>
          </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: "85%",
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: COLORS.text.primary,
  },
  closeButton: {
    padding: 4,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.text.secondary,
    marginTop: 16,
    marginBottom: 12,
  },
  reasonsContainer: {
    gap: 10,
    marginBottom: 20,
  },
  reasonButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#f5f5f5",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "transparent",
  },
  reasonButtonSelected: {
    backgroundColor: "#FFF0F0",
    borderColor: COLORS.primary.deepRed,
  },
  reasonText: {
    flex: 1,
    fontSize: 15,
    color: COLORS.text.primary,
    marginLeft: 12,
  },
  reasonTextSelected: {
    color: COLORS.primary.deepRed,
    fontWeight: "600",
  },
  checkmark: {
    marginLeft: 8,
  },
  descriptionLabel: {
    fontSize: 14,
    color: COLORS.text.secondary,
    marginBottom: 8,
  },
  descriptionInput: {
    backgroundColor: "#f5f5f5",
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: COLORS.text.primary,
    minHeight: 100,
    marginBottom: 20,
  },
  submitButton: {
    backgroundColor: COLORS.primary.deepRed,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginBottom: 10,
  },
  submitButtonDisabled: {
    backgroundColor: "#ccc",
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
