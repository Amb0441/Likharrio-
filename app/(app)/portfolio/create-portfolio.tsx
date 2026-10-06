import { Feather, Ionicons } from "@expo/vector-icons";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Modal,
  PanResponder,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import VerificationGateModal from "../../../components/ui/VerificationGateModal";
import { useAuth } from "../../../contexts/AuthContext";
import { db } from "../../../lib/firebase";
import { useArtistVerification } from "../../../hooks/useArtistVerification";
import { uploadMultipleImages } from "../../../utils/cloudinary";
import { notifyNewPortfolio } from "../../../utils/notifications";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const MAX_IMAGES = 3;

interface PortfolioFormData {
  title: string;
  description: string;
  category: string;
  tags: string;
}

const CATEGORIES = [
  { id: "painting", label: "Painting", icon: "brush" },
  {
    id: "drawing-illustration",
    label: "Drawing & Illustration",
    icon: "pencil",
  },
  { id: "weaving-textiles", label: "Weaving & Textiles", icon: "grid" },
  { id: "wood-craft", label: "Wood Craft", icon: "leaf" },
  { id: "sculpture", label: "Sculpture", icon: "cube" },
  { id: "other", label: "Other", icon: "ellipsis-horizontal" },
];

export default function CreatePortfolio() {
  const { user } = useAuth();
  const { canCreate, isPending, blockMessage } = useArtistVerification();
  const [gateVisible, setGateVisible] = useState(false);

  useEffect(() => {
    if (!canCreate) setGateVisible(true);
  }, [canCreate]);

  const [step, setStep] = useState<"select" | "preview" | "details">("select");
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [formData, setFormData] = useState<PortfolioFormData>({
    title: "",
    description: "",
    category: "",
    tags: "",
  });
  const [uploading, setUploading] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  // ── Crop state ──
  const [cropVisible, setCropVisible] = useState(false);
  const [cropImageUri, setCropImageUri] = useState<string | null>(null);
  const [cropImageIndex, setCropImageIndex] = useState<number>(0);
  const [cropImageSize, setCropImageSize] = useState({ width: 1, height: 1 });
  const cropOffset = useRef({ x: 0, y: 0 });
  const cropScale = useRef(1);
  const [cropOffsetState, setCropOffsetState] = useState({ x: 0, y: 0 });
  const [cropScaleState, setCropScaleState] = useState(1);
  const lastDistance = useRef<number | null>(null);
  const lastOffset = useRef({ x: 0, y: 0 });

  const CROP_SIZE = SCREEN_WIDTH - 48; // square crop frame

  const openCrop = (uri: string, index: number) => {
    Image.getSize(uri, (w, h) => {
      setCropImageSize({ width: w, height: h });
      // reset pan/zoom
      const initScale = CROP_SIZE / Math.min(w, h);
      cropOffset.current = { x: 0, y: 0 };
      cropScale.current = initScale;
      setCropOffsetState({ x: 0, y: 0 });
      setCropScaleState(initScale);
      setCropImageUri(uri);
      setCropImageIndex(index);
      setCropVisible(true);
    });
  };

  const clampOffset = (ox: number, oy: number, scale: number) => {
    const renderedW = cropImageSize.width * scale;
    const renderedH = cropImageSize.height * scale;
    const maxX = Math.max(0, (renderedW - CROP_SIZE) / 2);
    const maxY = Math.max(0, (renderedH - CROP_SIZE) / 2);
    return {
      x: Math.max(-maxX, Math.min(maxX, ox)),
      y: Math.max(-maxY, Math.min(maxY, oy)),
    };
  };

  const cropPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        lastOffset.current = { ...cropOffset.current };
        lastDistance.current = null;
      },
      onPanResponderMove: (_, gs) => {
        if (gs.numberActiveTouches === 2) {
          // pinch zoom
          const touches = (gs as any).nativeEvent?.touches;
          if (touches && touches.length === 2) {
            const dx = touches[0].pageX - touches[1].pageX;
            const dy = touches[0].pageY - touches[1].pageY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (lastDistance.current !== null) {
              const delta = dist / lastDistance.current;
              const newScale = Math.max(0.5, Math.min(4, cropScale.current * delta));
              cropScale.current = newScale;
              setCropScaleState(newScale);
            }
            lastDistance.current = dist;
          }
        } else {
          lastDistance.current = null;
          const newOffset = clampOffset(
            lastOffset.current.x + gs.dx,
            lastOffset.current.y + gs.dy,
            cropScale.current,
          );
          cropOffset.current = newOffset;
          setCropOffsetState(newOffset);
        }
      },
      onPanResponderRelease: () => {
        lastDistance.current = null;
      },
    }),
  ).current;

  const applyCrop = async () => {
    if (!cropImageUri) return;
    try {
      const scale = cropScaleState;
      const renderedW = cropImageSize.width * scale;
      const renderedH = cropImageSize.height * scale;
      // center of rendered image relative to crop frame center
      const imgLeft = (renderedW - CROP_SIZE) / 2 - cropOffsetState.x;
      const imgTop = (renderedH - CROP_SIZE) / 2 - cropOffsetState.y;
      // map crop frame coords back to original image pixels
      const originX = Math.max(0, imgLeft / scale);
      const originY = Math.max(0, imgTop / scale);
      const cropW = Math.min(cropImageSize.width - originX, CROP_SIZE / scale);
      const cropH = Math.min(cropImageSize.height - originY, CROP_SIZE / scale);

      const result = await manipulateAsync(
        cropImageUri,
        [
          { crop: { originX, originY, width: cropW, height: cropH } },
          { resize: { width: 1000 } },
        ],
        { compress: 0.85, format: SaveFormat.JPEG },
      );
      const updated = [...selectedImages];
      updated[cropImageIndex] = result.uri;
      setSelectedImages(updated);
      setCropVisible(false);
    } catch {
      Alert.alert("Error", "Failed to crop image. Please try again.");
    }
  };

  const compressLocally = async (uri: string): Promise<string> => {
    const manipResult = await manipulateAsync(
      uri,
      [{ resize: { width: 1000 } }],
      { compress: 0.8, format: SaveFormat.JPEG },
    );
    return manipResult.uri;
  };

  const pickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Please allow access to your photos");
      return;
    }
    const remaining = MAX_IMAGES - selectedImages.length;
    if (remaining <= 0) {
      Alert.alert("Limit reached", `You can add up to ${MAX_IMAGES} images`);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: remaining,
    });
    if (!result.canceled && result.assets) {
      try {
        const toAdd = result.assets.slice(0, remaining);
        const compressed = await Promise.all(
          toAdd.map((a) => compressLocally(a.uri)),
        );
        setSelectedImages((prev) =>
          [...prev, ...compressed].slice(0, MAX_IMAGES),
        );
        setStep("preview");
      } catch {
        Alert.alert("Error", "Failed to process images");
      }
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Please allow access to your camera");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets) {
      try {
        const compressed = await compressLocally(result.assets[0].uri);
        setSelectedImages([compressed]);
        setStep("preview");
      } catch {
        Alert.alert("Error", "Failed to process image");
      }
    }
  };

  const removeImage = (index: number) => {
    const newImages = selectedImages.filter((_, i) => i !== index);
    setSelectedImages(newImages);
    if (currentImageIndex >= newImages.length)
      setCurrentImageIndex(Math.max(0, newImages.length - 1));
    if (newImages.length === 0) setStep("select");
  };

  const handleNext = () => {
    if (selectedImages.length === 0) {
      Alert.alert("Error", "Please select at least one image");
      return;
    }
    setStep("details");
  };

  const handleSubmit = async () => {
    if (!user) {
      Alert.alert("Error", "You must be logged in");
      return;
    }
    if (!formData.title.trim()) {
      Alert.alert("Error", "Please add a title");
      return;
    }
    if (!formData.description.trim()) {
      Alert.alert("Error", "Please add a description");
      return;
    }
    if (!formData.category) {
      Alert.alert("Error", "Please select a category");
      return;
    }

    setUploading(true);
    try {
      const imageUrls = await uploadMultipleImages(
        selectedImages,
        "portfolios",
      );
      const portfolioData = {
        artistId: user.uid,
        artistEmail: user.email,
        title: formData.title,
        description: formData.description,
        category: formData.category,
        tags: formData.tags
          .split(",")
          .map((t) => t.trim())
          .filter((t) => t),
        coverImage: imageUrls[0],
        images: imageUrls,
        likes: 0,
        views: 0,
        saves: 0,
        status: "active",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      const portfolioRef = await addDoc(
        collection(db, "portfolios"),
        portfolioData,
      );

      try {
        const { getDocs, query, where } = await import("firebase/firestore");
        const followersSnap = await getDocs(
          query(collection(db, "following"), where("artistId", "==", user.uid)),
        );
        const artistName =
          user.displayName || user.email?.split("@")[0] || "An artist";
        followersSnap.docs.forEach(async (followerDoc) => {
          await notifyNewPortfolio(
            followerDoc.data().userId,
            artistName,
            user.uid,
            formData.title,
            portfolioRef.id,
            imageUrls[0],
          );
        });
      } catch {}

      Alert.alert("Success!", "Your showcase has been created!", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert("Error", "Failed to create showcase. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  // ─────────────────────────────────────────────
  // STEP 1 — Select images
  // ─────────────────────────────────────────────
  if (step === "select") {
    return (
      <SafeAreaView style={styles.root} edges={["top"]}>
        <StatusBar barStyle="dark-content" backgroundColor="#FAF7F2" />

        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Feather name="x" size={18} color="#2A1005" />
          </TouchableOpacity>
        </View>

        <VerificationGateModal
          visible={gateVisible}
          onClose={() => {
            setGateVisible(false);
            router.back();
          }}
          title={blockMessage.title}
          message={blockMessage.message}
          actionLabel={blockMessage.actionLabel}
          actionRoute={blockMessage.actionRoute}
          isPending={isPending}
        />

        <View style={styles.selectBody}>
          {/* Icon */}
          <View style={styles.selectIconBox}>
            <Feather name="image" size={36} color="#8B1A1A" />
          </View>

          <Text style={styles.selectTitle}>New Showcase</Text>
          <Text style={styles.selectSubtitle}>
            Share your artwork collection and creative journey with the
            community.
          </Text>

          {/* Buttons */}
          <View style={styles.selectButtons}>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={pickFromGallery}
              activeOpacity={0.8}
            >
              <Feather name="image" size={20} color="#fff" />
              <Text style={styles.primaryBtnText}>Choose from Gallery</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={takePhoto}
              activeOpacity={0.8}
            >
              <Feather name="camera" size={20} color="#8B1A1A" />
              <Text style={styles.secondaryBtnText}>Take Photo</Text>
            </TouchableOpacity>
          </View>

          {/* Info note */}
          <View style={styles.infoRow}>
            <Feather name="info" size={14} color="#9B8265" />
            <Text style={styles.infoText}>
              You can select up to {MAX_IMAGES} images
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ─────────────────────────────────────────────
  // STEP 2 — Preview
  // ─────────────────────────────────────────────
  if (step === "preview") {
    return (
      <SafeAreaView style={styles.root} edges={["top"]}>
        <StatusBar barStyle="dark-content" backgroundColor="#FAF7F2" />

        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => setStep("select")}
            activeOpacity={0.7}
          >
            <Feather name="arrow-left" size={18} color="#2A1005" />
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>Preview</Text>
          <TouchableOpacity
            style={styles.nextBtn}
            onPress={handleNext}
            activeOpacity={0.8}
          >
            <Text style={styles.nextBtnText}>Next</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.previewBody}>
          {/* Main image */}
          <View style={styles.mainImageWrap}>
            <Image
              source={{ uri: selectedImages[currentImageIndex] }}
              style={styles.mainImage}
              resizeMode="cover"
            />

            {/* Crop button */}
            <TouchableOpacity
              style={styles.cropBtn}
              onPress={() => openCrop(selectedImages[currentImageIndex], currentImageIndex)}
              activeOpacity={0.85}
            >
              <Feather name="crop" size={15} color="#fff" />
              <Text style={styles.cropBtnText}>Crop</Text>
            </TouchableOpacity>

            <View style={styles.imageCounter}>
              <Text style={styles.imageCounterText}>
                {currentImageIndex + 1}/{selectedImages.length}
              </Text>
            </View>

            {selectedImages.length > 1 && (
              <>
                {currentImageIndex > 0 && (
                  <TouchableOpacity
                    style={[styles.navBtn, styles.navBtnLeft]}
                    onPress={() => setCurrentImageIndex(currentImageIndex - 1)}
                  >
                    <Feather name="chevron-left" size={22} color="#fff" />
                  </TouchableOpacity>
                )}
                {currentImageIndex < selectedImages.length - 1 && (
                  <TouchableOpacity
                    style={[styles.navBtn, styles.navBtnRight]}
                    onPress={() => setCurrentImageIndex(currentImageIndex + 1)}
                  >
                    <Feather name="chevron-right" size={22} color="#fff" />
                  </TouchableOpacity>
                )}
                <View style={styles.dotsRow}>
                  {selectedImages.map((_, i) => (
                    <View
                      key={i}
                      style={[
                        styles.dot,
                        i === currentImageIndex && styles.dotActive,
                      ]}
                    />
                  ))}
                </View>
              </>
            )}
          </View>

          {/* Thumbnails */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.thumbStrip}
            contentContainerStyle={styles.thumbContent}
          >
            {selectedImages.map((uri, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.thumb,
                  index === currentImageIndex && styles.thumbActive,
                ]}
                onPress={() => setCurrentImageIndex(index)}
              >
                <Image source={{ uri }} style={styles.thumbImage} />
                <TouchableOpacity
                  style={styles.thumbRemove}
                  onPress={() => removeImage(index)}
                >
                  <Feather name="x" size={10} color="#fff" />
                </TouchableOpacity>
                {index === 0 && (
                  <View style={styles.coverBadge}>
                    <Text style={styles.coverBadgeText}>Cover</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
            {selectedImages.length < MAX_IMAGES && (
              <TouchableOpacity
                style={styles.thumbAdd}
                onPress={pickFromGallery}
              >
                <Feather name="plus" size={24} color="#9B8265" />
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>

        {/* ── Crop Modal ── */}
        <Modal visible={cropVisible} animationType="fade" statusBarTranslucent onRequestClose={() => setCropVisible(false)}>
          <View style={styles.cropModal}>
            <StatusBar barStyle="light-content" backgroundColor="#000" />

            {/* Header */}
            <View style={styles.cropHeader}>
              <TouchableOpacity style={styles.cropHeaderBtn} onPress={() => setCropVisible(false)}>
                <Feather name="x" size={20} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.cropHeaderTitle}>Crop Photo</Text>
              <TouchableOpacity style={[styles.cropHeaderBtn, styles.cropDoneBtn]} onPress={applyCrop}>
                <Text style={styles.cropDoneText}>Done</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.cropHint}>
              <Text style={styles.cropHintText}>Drag to reposition · Pinch to zoom</Text>
            </View>

            {/* Crop frame */}
            <View style={styles.cropArea}>
              <View
                style={[styles.cropFrame, { width: CROP_SIZE, height: CROP_SIZE }]}
                {...cropPanResponder.panHandlers}
              >
                {cropImageUri && (
                  <Image
                    source={{ uri: cropImageUri }}
                    style={{
                      width: cropImageSize.width * cropScaleState,
                      height: cropImageSize.height * cropScaleState,
                      transform: [
                        { translateX: cropOffsetState.x },
                        { translateY: cropOffsetState.y },
                      ],
                    }}
                    resizeMode="cover"
                  />
                )}
                {/* Grid overlay */}
                <View style={styles.cropGridOverlay} pointerEvents="none">
                  <View style={styles.cropGridRow}>
                    <View style={styles.cropGridCell} />
                    <View style={[styles.cropGridCell, styles.cropGridCellBorderH]} />
                    <View style={styles.cropGridCell} />
                  </View>
                  <View style={[styles.cropGridRow, styles.cropGridRowBorderV]}>
                    <View style={styles.cropGridCell} />
                    <View style={[styles.cropGridCell, styles.cropGridCellBorderH]} />
                    <View style={styles.cropGridCell} />
                  </View>
                  <View style={styles.cropGridRow}>
                    <View style={styles.cropGridCell} />
                    <View style={[styles.cropGridCell, styles.cropGridCellBorderH]} />
                    <View style={styles.cropGridCell} />
                  </View>
                </View>
                {/* Corner handles */}
                <View style={[styles.cropCorner, styles.cropCornerTL]} />
                <View style={[styles.cropCorner, styles.cropCornerTR]} />
                <View style={[styles.cropCorner, styles.cropCornerBL]} />
                <View style={[styles.cropCorner, styles.cropCornerBR]} />
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  // ─────────────────────────────────────────────
  // STEP 3 — Details
  // ─────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAF7F2" />

      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => setStep("preview")}
          activeOpacity={0.7}
        >
          <Feather name="arrow-left" size={18} color="#2A1005" />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Showcase Details</Text>
        <TouchableOpacity
          style={[styles.shareBtn, uploading && styles.shareBtnDisabled]}
          onPress={handleSubmit}
          disabled={uploading}
          activeOpacity={0.8}
        >
          {uploading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.shareBtnText}>Share</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.detailsScroll}
        contentContainerStyle={styles.detailsContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Cover preview strip */}
        <View style={styles.coverStrip}>
          {selectedImages.map((uri, i) => (
            <Image
              key={i}
              source={{ uri }}
              style={[styles.coverThumb, i === 0 && styles.coverThumbMain]}
              resizeMode="cover"
            />
          ))}
          <View style={styles.coverMeta}>
            <Text style={styles.coverMetaText}>
              {selectedImages.length}{" "}
              {selectedImages.length === 1 ? "photo" : "photos"} selected
            </Text>
            <TouchableOpacity onPress={() => setStep("preview")}>
              <Text style={styles.coverMetaEdit}>Edit</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Title */}
        <View style={styles.fieldSection}>
          <Text style={styles.fieldLabel}>
            Title <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Mountain Landscapes Series"
            placeholderTextColor="#C4AFA5"
            value={formData.title}
            onChangeText={(text) => setFormData({ ...formData, title: text })}
            editable={!uploading}
            maxLength={80}
          />
          <Text style={styles.charCount}>{formData.title.length}/80</Text>
        </View>

        {/* Description */}
        <View style={styles.fieldSection}>
          <Text style={styles.fieldLabel}>
            Description <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Describe your artwork, inspiration, materials used…"
            placeholderTextColor="#C4AFA5"
            multiline
            numberOfLines={4}
            value={formData.description}
            onChangeText={(text) =>
              setFormData({ ...formData, description: text })
            }
            editable={!uploading}
            textAlignVertical="top"
            maxLength={500}
          />
          <Text style={styles.charCount}>
            {formData.description.length}/500
          </Text>
        </View>

        {/* Category */}
        <View style={styles.fieldSection}>
          <Text style={styles.fieldLabel}>
            Category <Text style={styles.required}>*</Text>
          </Text>
          <TouchableOpacity
            style={styles.selectRow}
            onPress={() => setShowCategoryModal(true)}
            disabled={uploading}
            activeOpacity={0.7}
          >
            <Feather name="grid" size={16} color="#9B8265" />
            <Text
              style={[
                styles.selectRowText,
                !formData.category && styles.selectRowPlaceholder,
              ]}
            >
              {formData.category
                ? CATEGORIES.find((c) => c.id === formData.category)?.label
                : "Select a category"}
            </Text>
            <Feather name="chevron-right" size={16} color="#9B8265" />
          </TouchableOpacity>
        </View>

        {/* Tags */}
        <View style={styles.fieldSection}>
          <Text style={styles.fieldLabel}>
            Tags <Text style={styles.optional}>(optional)</Text>
          </Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., abstract, watercolor, nature"
            placeholderTextColor="#C4AFA5"
            value={formData.tags}
            onChangeText={(text) => setFormData({ ...formData, tags: text })}
            editable={!uploading}
          />
          <Text style={styles.helperText}>Separate tags with commas</Text>
        </View>

        {/* Info note */}
        <View style={styles.noteBox}>
          <Feather name="info" size={14} color="#8B1A1A" />
          <Text style={styles.noteText}>
            Your showcase will be visible to all users and highlight your
            artistic style.
          </Text>
        </View>
      </ScrollView>

      {/* Category bottom sheet */}
      <Modal
        visible={showCategoryModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCategoryModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowCategoryModal(false)}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Select Category</Text>
            <ScrollView>
              {CATEGORIES.map((cat) => {
                const active = formData.category === cat.id;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={styles.modalOption}
                    onPress={() => {
                      setFormData({ ...formData, category: cat.id });
                      setShowCategoryModal(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={cat.icon as any}
                      size={20}
                      color={active ? "#8B1A1A" : "#9B8265"}
                    />
                    <Text
                      style={[
                        styles.modalOptionText,
                        active && styles.modalOptionTextActive,
                      ]}
                    >
                      {cat.label}
                    </Text>
                    {active && (
                      <Feather name="check" size={18} color="#8B1A1A" />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#FAF7F2",
  },

  // ── Top bar ──
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#EDE0D4",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  topBarTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: "700",
    color: "#2A1005",
    letterSpacing: -0.2,
  },
  nextBtn: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#EDE0D4",
    backgroundColor: "#fff",
  },
  nextBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#8B1A1A",
  },
  shareBtn: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#8B1A1A",
    minWidth: 70,
    alignItems: "center",
    shadowColor: "#8B1A1A",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 2,
  },
  shareBtnDisabled: {
    backgroundColor: "#C4AFA5",
  },
  shareBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },

  // ── Step 1: Select ──
  selectBody: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 0,
  },
  selectIconBox: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: "#FDF5F2",
    borderWidth: 1,
    borderColor: "#F0DDD8",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  selectTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#2A1005",
    letterSpacing: -0.5,
    marginBottom: 10,
    textAlign: "center",
  },
  selectSubtitle: {
    fontSize: 15,
    color: "#9B8265",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 36,
  },
  selectButtons: {
    width: "100%",
    gap: 12,
    marginBottom: 24,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#8B1A1A",
    paddingVertical: 18,
    borderRadius: 14,
    shadowColor: "#8B1A1A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#fff",
    paddingVertical: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#EDE0D4",
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#8B1A1A",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  infoText: {
    fontSize: 13,
    color: "#9B8265",
  },

  // ── Step 2: Preview ──
  previewBody: {
    flex: 1,
  },
  mainImageWrap: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH,
    backgroundColor: "#000",
    position: "relative",
  },
  mainImage: {
    width: "100%",
    height: "100%",
  },
  imageCounter: {
    position: "absolute",
    top: 14,
    right: 14,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  imageCounterText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  navBtn: {
    position: "absolute",
    top: "50%",
    transform: [{ translateY: -20 }],
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  navBtnLeft: { left: 14 },
  navBtnRight: { right: 14 },
  dotsRow: {
    position: "absolute",
    bottom: 14,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.45)",
  },
  dotActive: {
    backgroundColor: "#fff",
    width: 20,
  },
  thumbStrip: {
    borderTopWidth: 1,
    borderTopColor: "#EDE0D4",
    backgroundColor: "#FAF7F2",
  },
  thumbContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 10,
  },
  thumb: {
    width: 68,
    height: 68,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "transparent",
    overflow: "visible",
  },
  thumbActive: {
    borderColor: "#8B1A1A",
  },
  thumbImage: {
    width: "100%",
    height: "100%",
    borderRadius: 10,
  },
  thumbRemove: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#8B1A1A",
    alignItems: "center",
    justifyContent: "center",
  },
  coverBadge: {
    position: "absolute",
    bottom: 4,
    left: 4,
    backgroundColor: "rgba(139,26,26,0.85)",
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  coverBadgeText: {
    color: "#fff",
    fontSize: 8,
    fontWeight: "700",
  },
  thumbAdd: {
    width: 68,
    height: 68,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#EDE0D4",
    borderStyle: "dashed",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },

  // ── Crop button on preview ──
  cropBtn: {
    position: "absolute",
    bottom: 14,
    right: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  cropBtnText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },

  // ── Crop modal ──
  cropModal: {
    flex: 1,
    backgroundColor: "#000",
  },
  cropHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 52,
    paddingBottom: 16,
    backgroundColor: "#111",
  },
  cropHeaderBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  cropHeaderTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#fff",
  },
  cropDoneBtn: {
    backgroundColor: "#8B1A1A",
    borderRadius: 18,
    paddingHorizontal: 16,
    width: "auto",
  },
  cropDoneText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
  cropHint: {
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: "#111",
  },
  cropHintText: {
    fontSize: 12,
    color: "rgba(255,255,255,0.45)",
  },
  cropArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#000",
  },
  cropFrame: {
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.7)",
  },
  cropGridOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  cropGridRow: {
    flex: 1,
    flexDirection: "row",
  },
  cropGridRowBorderV: {
    borderTopWidth: 0.5,
    borderBottomWidth: 0.5,
    borderColor: "rgba(255,255,255,0.25)",
  },
  cropGridCell: {
    flex: 1,
  },
  cropGridCellBorderH: {
    borderLeftWidth: 0.5,
    borderRightWidth: 0.5,
    borderColor: "rgba(255,255,255,0.25)",
  },
  cropCorner: {
    position: "absolute",
    width: 18,
    height: 18,
    borderColor: "#fff",
  },
  cropCornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
  },
  cropCornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
  },
  cropCornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
  },
  cropCornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
  },

  // ── Step 3: Details ──
  detailsScroll: { flex: 1 },
  detailsContent: { paddingBottom: 48 },

  coverStrip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#EDE0D4",
  },
  coverThumb: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#EDE0D4",
  },
  coverThumbMain: {
    width: 56,
    height: 56,
  },
  coverMeta: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginLeft: 4,
  },
  coverMetaText: {
    fontSize: 13,
    color: "#9B8265",
  },
  coverMetaEdit: {
    fontSize: 13,
    fontWeight: "700",
    color: "#8B1A1A",
  },

  fieldSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 4,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#2A1005",
    marginBottom: 10,
    letterSpacing: 0.1,
  },
  required: { color: "#8B1A1A" },
  optional: { color: "#9B8265", fontWeight: "500" },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#EDE0D4",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: "#2A1005",
    shadowColor: "#2A1005",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  textArea: {
    height: 110,
    paddingTop: 14,
  },
  charCount: {
    fontSize: 12,
    color: "#9B8265",
    textAlign: "right",
    marginTop: 6,
  },
  helperText: {
    fontSize: 12,
    color: "#9B8265",
    marginTop: 6,
  },
  selectRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#EDE0D4",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: "#2A1005",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  selectRowText: {
    flex: 1,
    fontSize: 15,
    color: "#2A1005",
    fontWeight: "500",
  },
  selectRowPlaceholder: {
    color: "#C4AFA5",
    fontWeight: "400",
  },
  noteBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginHorizontal: 20,
    marginTop: 20,
    padding: 14,
    backgroundColor: "#FDF5F2",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#F0DDD8",
  },
  noteText: {
    flex: 1,
    fontSize: 13,
    color: "#6B5946",
    lineHeight: 19,
  },

  // ── Category modal ──
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: "#FAF7F2",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 36,
    maxHeight: "70%",
  },
  modalHandle: {
    width: 36,
    height: 4,
    backgroundColor: "#EDE0D4",
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#2A1005",
    textAlign: "center",
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  modalOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#EDE0D4",
  },
  modalOptionText: {
    flex: 1,
    fontSize: 15,
    color: "#2A1005",
  },
  modalOptionTextActive: {
    color: "#8B1A1A",
    fontWeight: "700",
  },
});
