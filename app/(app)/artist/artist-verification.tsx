import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import {
  doc, serverTimestamp, setDoc, updateDoc,
} from "firebase/firestore";
import { useState } from "react";
import {
  ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { db } from "../../../lib/firebase";
import { uploadImageToCloudinary } from "../../../utils/cloudinary";
import COLORS from "../../../constants/Colors";
import { useAuth } from "../../../contexts/AuthContext";

const MAX_SAMPLES = 3;

export default function ArtistVerificationScreen() {
  const router = useRouter();
  const { user, refreshUserProfile } = useAuth();

  const [govIdUri, setGovIdUri] = useState<string | null>(null);
  const [selfieUri, setSelfieUri] = useState<string | null>(null);
  const [sampleUris, setSampleUris] = useState<string[]>([]);
  const [portfolioLink, setPortfolioLink] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // ─── Image pickers ──────────────────────────────────────────────────────────

  const pickGovId = () => {
    Alert.alert(
      "Upload Government ID",
      "How would you like to upload your ID?",
      [
        {
          text: "Crop / Edit Photo",
          onPress: () => launchGovIdPicker(true),
        },
        {
          text: "Upload Full Photo",
          onPress: () => launchGovIdPicker(false),
        },
        { text: "Cancel", style: "cancel" },
      ]
    );
  };

  const launchGovIdPicker = async (withCrop: boolean) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Please allow access to your photo library.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: withCrop,
      aspect: withCrop ? [85, 54] : undefined,
      quality: 1,
    });
    if (!result.canceled && result.assets[0]) {
      const compressed = await manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 1200 } }],
        { compress: 0.88, format: SaveFormat.JPEG }
      );
      setGovIdUri(compressed.uri);
    }
  };

  const takeSelfie = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Camera permission needed", "Please allow camera access to take a selfie.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
      cameraType: ImagePicker.CameraType.front,
    });
    if (!result.canceled && result.assets[0]) {
      // Compress before upload: resize to 800px (selfie — face + ID need to be clear)
      const compressed = await manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 800 } }],
        { compress: 0.88, format: SaveFormat.JPEG }
      );
      setSelfieUri(compressed.uri);
    }
  };

  const pickSelfieFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Please allow access to your photo library.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 1,
    });
    if (!result.canceled && result.assets[0] && result.assets[0].uri) {
      // Compress before upload: resize to 800px (selfie — face + ID need to be clear)
      const compressed = await manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 800 } }],
        { compress: 0.88, format: SaveFormat.JPEG }
      );
      setSelfieUri(compressed.uri);
    }
  };

  const pickSample = async () => {
    if (sampleUris.length >= MAX_SAMPLES) {
      Alert.alert("Limit reached", `You can upload up to ${MAX_SAMPLES} sample artworks.`);
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Please allow access to your photo library.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 1,
    });
    if (!result.canceled && result.assets[0]) {
      // Compress before upload: resize to 1000px and apply smart compression for artwork samples
      const compressed = await manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 1000 } }],
        { compress: 0.87, format: SaveFormat.JPEG }
      );
      setSampleUris((prev) => [...prev, compressed.uri]);
    }
  };

  const removeSample = (index: number) => {
    setSampleUris((prev) => prev.filter((_, i) => i !== index));
  };

  // ─── Upload a single image to Cloudinary ────────────────────────────────────
  const uploadImage = async (uri: string): Promise<string> => {
    return await uploadImageToCloudinary(uri, 'verifications');
  };

  // ─── Submit verification ─────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!govIdUri) {
      Alert.alert("Missing ID", "Please upload a government-issued ID.");
      return;
    }
    if (!selfieUri) {
      Alert.alert("Missing Selfie", "Please take a selfie holding your ID for identity verification.");
      return;
    }
    if (sampleUris.length < 1) {
      Alert.alert("Missing Artworks", "Please upload at least 1 sample artwork.");
      return;
    }
    if (!user) return;

    setSubmitting(true);
    try {
      const govIdUrl = await uploadImage(govIdUri);
      const selfieUrl = await uploadImage(selfieUri);

      const sampleUrls: string[] = [];
      for (let i = 0; i < sampleUris.length; i++) {
        const url = await uploadImage(sampleUris[i]);
        sampleUrls.push(url);
      }

      await setDoc(doc(db, "verificationRequests", user.uid), {
        uid: user.uid,
        email: user.email,
        govIdUrl,
        selfieUrl,
        sampleUrls,
        portfolioLink: portfolioLink.trim() || null,
        status: "pending",
        submittedAt: serverTimestamp(),
      });

      await updateDoc(doc(db, "users", user.uid), {
        artistStatus: "pending",
        verified: false,
      });

      await refreshUserProfile();

      Alert.alert(
        "Submitted! 🎉",
        "Your verification request has been submitted. You'll be notified once it's reviewed.",
        [{ text: "OK", onPress: () => router.replace("/(app)/artist/artist-home") }]
      );
    } catch (e) {
      console.error("Verification submission error:", e);
      Alert.alert("Error", "Failed to submit verification. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Skip ───────────────────────────────────────────────────────────────────
  const handleSkip = async () => {
    Alert.alert(
      "Skip Verification?",
      "You can submit verification later from your profile. Some features may be limited until you're verified.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Skip for Now",
          onPress: async () => {
            if (user) {
              await updateDoc(doc(db, "users", user.uid), {
                artistStatus: "unsubmitted",
              });
              await refreshUserProfile();
            }
            router.replace("/(app)/artist/artist-home");
          },
        },
      ]
    );
  };

  // ─── Reusable image preview ──────────────────────────────────────────────────
  // showCropBtn: show a separate "Crop" button alongside "Replace" (for Gov ID)
  const ImagePreview = ({
    uri,
    onReplace,
    onCrop,
  }: {
    uri: string;
    onReplace: () => void;
    onCrop?: () => void;
  }) => (
    <View style={styles.previewWrap}>
      <Image
        source={{ uri }}
        style={styles.previewImage}
        resizeMode="cover"
      />
      <View style={styles.previewActions}>
        {onCrop && (
          <TouchableOpacity style={styles.cropBtn} onPress={onCrop}>
            <Ionicons name="crop-outline" size={14} color="#fff" />
            <Text style={styles.previewBtnText}>Crop</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.replaceBtn} onPress={onReplace}>
          <Ionicons name="refresh-outline" size={14} color="#fff" />
          <Text style={styles.previewBtnText}>Replace</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "padding"}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.headerWrap}>
            <View style={styles.iconCircle}>
              <Ionicons name="shield-checkmark-outline" size={40} color={COLORS.primary.deepRed} />
            </View>
            <Text style={styles.title}>Artist Verification</Text>
            <Text style={styles.subtitle}>
              Verify your identity so buyers can trust your artwork. Your documents are reviewed privately and never shared publicly.
            </Text>
          </View>

          {/* Step 1 – Government ID */}
          <View style={styles.section}>
            <View style={styles.stepHeader}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepNum}>1</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.stepTitle}>Government-Issued ID</Text>
                <Text style={styles.stepHint}>Passport, driver's license, SSS, PhilSys, etc.</Text>
              </View>
              <Text style={styles.required}>Required</Text>
            </View>

            {govIdUri ? (
              <ImagePreview
                uri={govIdUri}
                onReplace={() => launchGovIdPicker(false)}
                onCrop={() => launchGovIdPicker(true)}
              />
            ) : (
              <View style={styles.govIdButtons}>
                <TouchableOpacity style={styles.selfiePrimaryBtn} onPress={() => launchGovIdPicker(false)}>
                  <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
                  <Text style={styles.selfiePrimaryBtnText}>Upload Full Photo</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.selfieSecondaryBtn} onPress={() => launchGovIdPicker(true)}>
                  <Ionicons name="crop-outline" size={18} color={COLORS.primary.deepRed} />
                  <Text style={styles.selfieSecondaryBtnText}>Crop &amp; Upload</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Step 2 – Selfie with ID */}
          <View style={styles.section}>
            <View style={styles.stepHeader}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepNum}>2</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.stepTitle}>Selfie with ID</Text>
                <Text style={styles.stepHint}>Hold your ID next to your face — front camera preferred</Text>
              </View>
              <Text style={styles.required}>Required</Text>
            </View>

            {selfieUri ? (
              <ImagePreview
                uri={selfieUri}
                onReplace={() =>
                  Alert.alert(
                    "Replace Selfie",
                    "How would you like to replace your selfie?",
                    [
                      { text: "Open Camera", onPress: takeSelfie },
                      { text: "Choose from Gallery", onPress: pickSelfieFromGallery },
                      { text: "Cancel", style: "cancel" },
                    ]
                  )
                }
              />
            ) : (
              <View style={styles.selfieBox}>
                <View style={styles.selfieIllustration}>
                  <Ionicons name="person-circle-outline" size={48} color={COLORS.text.muted} />
                  <View style={styles.selfieIdBadge}>
                    <Ionicons name="id-card" size={20} color={COLORS.primary.deepRed} />
                  </View>
                </View>
                <Text style={styles.selfieBoxTitle}>Take a selfie holding your ID</Text>
                <Text style={styles.selfieBoxHint}>Make sure your face and ID are clearly visible</Text>
                <View style={styles.selfieButtons}>
                  <TouchableOpacity style={styles.selfiePrimaryBtn} onPress={takeSelfie}>
                    <Ionicons name="camera" size={18} color="#fff" />
                    <Text style={styles.selfiePrimaryBtnText}>Open Camera</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.selfieSecondaryBtn} onPress={pickSelfieFromGallery}>
                    <Ionicons name="images-outline" size={18} color={COLORS.primary.deepRed} />
                    <Text style={styles.selfieSecondaryBtnText}>Choose from Gallery</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          {/* Step 3 – Sample Artworks */}
          <View style={styles.section}>
            <View style={styles.stepHeader}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepNum}>3</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.stepTitle}>Sample Artworks</Text>
                <Text style={styles.stepHint}>Upload 1–3 photos of your own original work</Text>
              </View>
              <Text style={styles.required}>Required</Text>
            </View>

            <View style={styles.samplesGrid}>
              {sampleUris.map((uri, i) => (
                <View key={i} style={styles.sampleThumb}>
                  <Image source={{ uri }} style={styles.sampleImage} resizeMode="cover" />
                  <TouchableOpacity style={styles.removeBtn} onPress={() => removeSample(i)}>
                    <Ionicons name="close" size={14} color="#fff" />
                  </TouchableOpacity>
                </View>
              ))}
              {sampleUris.length < MAX_SAMPLES && (
                <TouchableOpacity style={styles.addSampleBox} onPress={pickSample}>
                  <Ionicons name="add" size={32} color={COLORS.text.muted} />
                  <Text style={styles.addSampleText}>Add Photo</Text>
                </TouchableOpacity>
              )}
            </View>

            <Text style={styles.sampleCount}>
              {sampleUris.length} / {MAX_SAMPLES} photos added
            </Text>
          </View>

          {/* Step 4 – Portfolio Link (Optional) */}
          <View style={styles.section}>
            <View style={styles.stepHeader}>
              <View style={[styles.stepBadge, styles.stepBadgeOptional]}>
                <Text style={styles.stepNum}>4</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.stepTitle}>Portfolio Link</Text>
                <Text style={styles.stepHint}>Behance, Instagram, personal website, etc.</Text>
              </View>
              <Text style={styles.optional}>Optional</Text>
            </View>

            <TextInput
              style={styles.input}
              value={portfolioLink}
              onChangeText={setPortfolioLink}
              placeholder="https://behance.net/yourname"
              placeholderTextColor={COLORS.text.muted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
          </View>

          {/* Info box */}
          <View style={styles.infoBox}>
            <Ionicons name="information-circle-outline" size={20} color="#5B6FE0" />
            <Text style={styles.infoText}>
              Reviews typically take 1–3 business days. You'll receive an in-app notification when your account is approved.
            </Text>
          </View>

          {/* Actions */}
          <TouchableOpacity
            style={[styles.submitBtn, submitting && styles.btnDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="cloud-upload-outline" size={20} color="#fff" />
                <Text style={styles.submitBtnText}>Submit for Verification</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.skipBtn} onPress={handleSkip} disabled={submitting}>
            <Text style={styles.skipBtnText}>Skip for Now</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background.primary,
  },
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 48,
  },

  // Header
  headerWrap: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFF0F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.text.primary,
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 8,
  },

  // Section
  section: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primary.deepRed,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepBadgeOptional: {
    backgroundColor: '#8B8B8B',
  },
  stepNum: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  stepHint: {
    fontSize: 12,
    color: COLORS.text.muted,
    marginTop: 2,
  },
  required: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary.deepRed,
    paddingTop: 4,
  },
  optional: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8B8B8B',
    paddingTop: 4,
  },

  // Gov ID
  govIdButtons: {
    flexDirection: 'column',
    gap: 10,
  },

  // ── Image preview ────────────────────────────────────────────────────────────
  previewWrap: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  // Row of action buttons pinned to the bottom of the preview
  previewActions: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    flexDirection: 'row',
    gap: 8,
  },
  cropBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(139,26,26,0.82)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  replaceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  previewBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },

  // Sample grid
  samplesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 8,
  },
  sampleThumb: {
    width: 90,
    height: 90,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  sampleImage: {
    width: '100%',
    height: '100%',
  },
  removeBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 10,
    width: 22,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addSampleBox: {
    width: 90,
    height: 90,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.border.light,
    borderStyle: 'dashed',
    backgroundColor: COLORS.background.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  addSampleText: {
    fontSize: 11,
    color: COLORS.text.muted,
    fontWeight: '600',
  },
  sampleCount: {
    fontSize: 12,
    color: COLORS.text.muted,
    textAlign: 'right',
  },

  // Selfie
  selfieBox: {
    borderWidth: 2,
    borderColor: COLORS.border.light,
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.background.secondary,
  },
  selfieIllustration: {
    position: 'relative',
    width: 72,
    height: 72,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  selfieIdBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#FFF0F0',
    borderRadius: 12,
    padding: 2,
    borderWidth: 1.5,
    borderColor: COLORS.primary.deepRed,
  },
  selfieBoxTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text.primary,
    textAlign: 'center',
  },
  selfieBoxHint: {
    fontSize: 12,
    color: COLORS.text.muted,
    textAlign: 'center',
    marginBottom: 12,
  },
  selfieButtons: {
    flexDirection: 'column',
    gap: 10,
    width: '100%',
  },
  selfiePrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary.deepRed,
    paddingVertical: 13,
    borderRadius: 10,
  },
  selfiePrimaryBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  selfieSecondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFF0F0',
    paddingVertical: 13,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.primary.deepRed,
  },
  selfieSecondaryBtnText: {
    color: COLORS.primary.deepRed,
    fontSize: 15,
    fontWeight: '600',
  },

  // Portfolio input
  input: {
    backgroundColor: COLORS.background.secondary,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.text.primary,
    borderWidth: 1.5,
    borderColor: COLORS.border.light,
  },

  // Info box
  infoBox: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    backgroundColor: '#EEF1FF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 24,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#3D4DB7',
    lineHeight: 19,
  },

  // Buttons
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: COLORS.primary.deepRed,
    paddingVertical: 16,
    borderRadius: 14,
    shadowColor: COLORS.primary.deepRed,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 12,
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  skipBtn: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  skipBtnText: {
    fontSize: 15,
    color: COLORS.text.muted,
    fontWeight: '600',
  },
});
