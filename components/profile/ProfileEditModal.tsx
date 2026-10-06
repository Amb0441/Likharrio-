import { Feather } from "@expo/vector-icons";
import {
  ActivityIndicator,
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
import COLORS from "../../constants/Colors";

const ARTIST_TYPES = [
  "Painting",
  "Drawing & Illustration",
  "Weaving & Textiles",
  "Other",
];

interface ProfileEditModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: () => void;
  editName: string;
  setEditName: (name: string) => void;
  editBio: string;
  setEditBio: (bio: string) => void;
  editArtistType: string;
  setEditArtistType: (type: string) => void;
  saving: boolean;
}

export default function ProfileEditModal({
  visible,
  onClose,
  onSave,
  editName,
  setEditName,
  editBio,
  setEditBio,
  editArtistType,
  setEditArtistType,
  saving,
}: ProfileEditModalProps) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={
          Platform.OS === "ios" ? "padding" : "height"
        }
        style={styles.modalOverlay}
      >
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Edit Profile</Text>
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={onClose}
            >
              <Feather
                name="x"
                size={18}
                color={COLORS.text.primary}
              />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.formContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.fieldSection}>
              <Text style={styles.fieldLabel}>Artist Name</Text>
              <TextInput
                style={styles.input}
                value={editName}
                onChangeText={setEditName}
                placeholder="Enter your artist name"
                placeholderTextColor={COLORS.text.faint}
              />
            </View>

            <View style={styles.fieldSection}>
              <Text style={styles.fieldLabel}>
                Type of Artist
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chips}
              >
                {ARTIST_TYPES.map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.chip,
                      editArtistType === type &&
                      styles.chipActive,
                    ]}
                    onPress={() => setEditArtistType(type)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        editArtistType === type &&
                        styles.chipTextActive,
                      ]}
                    >
                      {type}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.fieldSection}>
              <Text style={styles.fieldLabel}>
                Bio / Statement
              </Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={editBio}
                onChangeText={setEditBio}
                placeholder="Describe your art style and background…"
                placeholderTextColor={COLORS.text.faint}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            <TouchableOpacity
              style={[
                styles.saveBtn,
                saving && styles.saveBtnDisabled,
              ]}
              onPress={onSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator
                  size="small"
                  color={COLORS.text.white}
                />
              ) : (
                <Text style={styles.saveBtnText}>
                  Save Changes
                </Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay.medium,
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: COLORS.background.primary,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "85%",
  },
  modalHandle: {
    width: 36,
    height: 4,
    backgroundColor: COLORS.border.primary,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 4,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.primary,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: COLORS.text.primary,
    letterSpacing: -0.2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border.primary,
    backgroundColor: COLORS.text.white,
    alignItems: "center",
    justifyContent: "center",
  },
  formContent: {
    padding: 20,
    gap: 4,
    paddingBottom: 40,
  },
  fieldSection: {
    marginBottom: 18,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.text.primary,
    marginBottom: 10,
    letterSpacing: 0.1,
  },
  input: {
    backgroundColor: COLORS.text.white,
    borderWidth: 1,
    borderColor: COLORS.border.primary,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: COLORS.text.primary,
  },
  textArea: {
    height: 100,
    paddingTop: 14,
  },
  chips: {
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border.primary,
    backgroundColor: COLORS.text.white,
  },
  chipActive: {
    backgroundColor: COLORS.primary.deepRed,
    borderColor: COLORS.primary.deepRed,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "500",
    color: COLORS.text.dark,
  },
  chipTextActive: {
    color: COLORS.text.white,
    fontWeight: "700",
  },
  saveBtn: {
    backgroundColor: COLORS.primary.deepRed,
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: "center",
    marginTop: 8,
  },
  saveBtnDisabled: {
    backgroundColor: COLORS.text.faint,
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.text.white,
  },
});
