import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useGuardedRouter } from "../../../utils/navigationGuard";
import {
  deleteDoc,
  doc,
  getDoc,
  updateDoc,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import COLORS from "../../../constants/Colors";
import { useAuth } from "../../../contexts/AuthContext";
import { db } from "../../../lib/firebase";

// ── Types ──
interface ListingData {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  imageUrl: string;
  images: string[];
  artistId: string;
  currentQuantity: number;
  initialQuantity: number;
  status: string;
}

const CATEGORIES = [
  "Painting",
  "Drawing & Illustration",
  "Weaving & Textiles",
  "Wood Craft",
  "Sculpture",
  "Other",
];

export default function EditListing() {
  const { user } = useAuth();
  const { id } = useLocalSearchParams();
  const { guardedPush, guardedReplace, guardedBack } = useGuardedRouter();

  const [listing, setListing] = useState<ListingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    price: "",
    category: "",
    currentQuantity: "",
  });

  // ── Fetch listing ──
  useEffect(() => {
    if (id) fetchListing();
  }, [id]);

  const fetchListing = async () => {
    try {
      const docSnap = await getDoc(doc(db, "listings", id as string));
      if (docSnap.exists()) {
        const data = docSnap.data() as Omit<ListingData, "id">;
        setListing({ id: docSnap.id, ...data });
        setFormData({
          title: data.title,
          description: data.description,
          price: data.price.toString(),
          category: data.category,
          currentQuantity: data.currentQuantity.toString(),
        });
      } else {
        Alert.alert("Error", "Listing not found");
        guardedBack();
      }
    } catch {
      Alert.alert("Error", "Failed to load listing");
    } finally {
      setLoading(false);
    }
  };

  // ── Save changes ──
  const handleSave = async () => {
    if (!user || !listing) return;
    if (listing.artistId !== user.uid) {
      Alert.alert("Error", "You can only edit your own listings");
      return;
    }
    if (!formData.title.trim() || !formData.description.trim() || !formData.price) {
      Alert.alert("Error", "Please fill in all required fields");
      return;
    }
    const price = parseFloat(formData.price);
    if (isNaN(price) || price <= 0) {
      Alert.alert("Error", "Please enter a valid price");
      return;
    }
    const quantity = parseInt(formData.currentQuantity);
    if (isNaN(quantity) || quantity < 0) {
      Alert.alert("Error", "Please enter a valid quantity");
      return;
    }
    Alert.alert("Save Changes", "Are you sure you want to update this listing?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Save",
        onPress: async () => {
          try {
            setSaving(true);
            await updateDoc(doc(db, "listings", id as string), {
              title: formData.title.trim(),
              description: formData.description.trim(),
              price,
              category: formData.category,
              currentQuantity: quantity,
              status: quantity === 0 ? "sold" : "active",
              updatedAt: new Date(),
            });
            Alert.alert("Success", "Listing updated successfully!", [
              { text: "OK", onPress: () => guardedBack() },
            ]);
          } catch {
            Alert.alert("Error", "Failed to update listing");
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  // ── Delete listing ──
  const handleDelete = async () => {
    if (!user || !listing) return;
    if (listing.artistId !== user.uid) {
      Alert.alert("Error", "You can only delete your own listings");
      return;
    }
    Alert.alert(
      "Delete Listing",
      "Are you sure? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setDeleting(true);
              await deleteDoc(doc(db, "listings", id as string));
              Alert.alert("Success", "Listing deleted successfully", [
                {
                  text: "OK",
                  onPress: () =>
                    guardedReplace("/(app)/marketplace/artist-marketplace"),
                },
              ]);
            } catch {
              Alert.alert("Error", "Failed to delete listing");
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  // ── Loading state ──
  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary.deepRed} />
          <Text style={styles.loadingText}>Loading listing…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!listing) return null;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => guardedBack()}>
          <Ionicons name="arrow-back" size={20} color={COLORS.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Listing</Text>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={handleDelete}
          disabled={deleting}
        >
          {deleting ? (
            <ActivityIndicator size="small" color={COLORS.status.error.text} />
          ) : (
            <Ionicons name="trash-outline" size={20} color={COLORS.status.error.text} />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>

        {/* Cover image preview */}
        {listing.imageUrl && (
          <View style={styles.imageSection}>
            <Text style={styles.sectionLabel}>Cover Image</Text>
            <Image
              source={{ uri: listing.imageUrl }}
              style={styles.coverImage}
              resizeMode="cover"
            />
            <Text style={styles.imageNote}>
              To change images, please create a new listing
            </Text>
          </View>
        )}

        {/* Title */}
        <View style={styles.fieldSection}>
          <Text style={styles.fieldLabel}>
            Title <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={styles.input}
            value={formData.title}
            onChangeText={(text) => setFormData({ ...formData, title: text })}
            placeholder="Enter listing title"
            placeholderTextColor={COLORS.text.muted}
          />
        </View>

        {/* Description */}
        <View style={styles.fieldSection}>
          <Text style={styles.fieldLabel}>
            Description <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={formData.description}
            onChangeText={(text) => setFormData({ ...formData, description: text })}
            placeholder="Describe your item"
            placeholderTextColor={COLORS.text.muted}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Price */}
        <View style={styles.fieldSection}>
          <Text style={styles.fieldLabel}>
            Price (₱) <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={styles.input}
            value={formData.price}
            onChangeText={(text) =>
              setFormData({ ...formData, price: text.replace(/[^0-9.]/g, "") })
            }
            placeholder="0.00"
            placeholderTextColor={COLORS.text.muted}
            keyboardType="decimal-pad"
          />
        </View>

        {/* Quantity */}
        <View style={styles.fieldSection}>
          <Text style={styles.fieldLabel}>
            Current Quantity <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={styles.input}
            value={formData.currentQuantity}
            onChangeText={(text) =>
              setFormData({ ...formData, currentQuantity: text.replace(/[^0-9]/g, "") })
            }
            placeholder="0"
            placeholderTextColor={COLORS.text.muted}
            keyboardType="number-pad"
          />
          <Text style={styles.helperText}>
            Initial quantity: {listing.initialQuantity}
          </Text>
        </View>

        {/* Category */}
        <View style={styles.fieldSection}>
          <Text style={styles.fieldLabel}>
            Category <Text style={styles.required}>*</Text>
          </Text>
          <TouchableOpacity
            style={styles.categoryButton}
            onPress={() => setShowCategoryModal(true)}
          >
            <Text style={styles.categoryButtonText}>
              {formData.category || "Select a category"}
            </Text>
            <Ionicons name="chevron-down" size={18} color={COLORS.text.secondary} />
          </TouchableOpacity>
        </View>

        {/* Save button */}
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
              <Text style={styles.saveButtonText}>Save Changes</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Category modal */}
      <Modal
        visible={showCategoryModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCategoryModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Category</Text>
              <TouchableOpacity onPress={() => setShowCategoryModal(false)}>
                <Ionicons name="close" size={22} color={COLORS.text.primary} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.categoryOption,
                    formData.category === cat && styles.categoryOptionSelected,
                  ]}
                  onPress={() => {
                    setFormData({ ...formData, category: cat });
                    setShowCategoryModal(false);
                  }}
                >
                  <Text
                    style={[
                      styles.categoryOptionText,
                      formData.category === cat && styles.categoryOptionTextSelected,
                    ]}
                  >
                    {cat}
                  </Text>
                  {formData.category === cat && (
                    <Ionicons name="checkmark" size={20} color={COLORS.primary.deepRed} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ── Styles ──
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background.primary,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: COLORS.text.secondary,
  },

  // Header
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
    backgroundColor: "#fff",
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
  deleteButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(220,38,38,0.08)",
    justifyContent: "center",
    alignItems: "center",
  },

  // Content
  content: { flex: 1 },

  // Image preview
  imageSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.light,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.text.primary,
    marginBottom: 12,
  },
  coverImage: {
    width: "100%",
    height: 200,
    borderRadius: 14,
    backgroundColor: COLORS.background.secondary,
  },
  imageNote: {
    fontSize: 12,
    color: COLORS.text.muted,
    marginTop: 8,
    fontStyle: "italic",
  },

  // Form fields
  fieldSection: {
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.light,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.text.primary,
    marginBottom: 10,
    letterSpacing: 0.1,
  },
  required: { color: COLORS.primary.deepRed },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: COLORS.border.light,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: COLORS.text.primary,
  },
  textArea: {
    height: 120,
    paddingTop: 14,
    textAlignVertical: "top",
  },
  helperText: {
    fontSize: 12,
    color: COLORS.text.muted,
    marginTop: 6,
  },
  categoryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: COLORS.border.light,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  categoryButtonText: {
    fontSize: 15,
    color: COLORS.text.primary,
  },

  // Save button
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary.deepRed,
    marginHorizontal: 20,
    marginTop: 24,
    paddingVertical: 17,
    borderRadius: 14,
    gap: 8,
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },

  // Category modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: COLORS.background.primary,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: "70%",
    paddingBottom: 32,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border.light,
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 4,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.light,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: COLORS.text.primary,
  },
  categoryOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.light,
  },
  categoryOptionSelected: {
    backgroundColor: "rgba(139,26,26,0.05)",
  },
  categoryOptionText: {
    fontSize: 15,
    color: COLORS.text.primary,
  },
  categoryOptionTextSelected: {
    fontWeight: "700",
    color: COLORS.primary.deepRed,
  },
});
