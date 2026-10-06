import { Feather } from '@expo/vector-icons';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import {
  addDoc,
  collection,
  serverTimestamp,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import COLORS from '../../../constants/Colors';
import VerificationGateModal from '../../../components/ui/VerificationGateModal';
import { db } from '../../../lib/firebase';
import { useArtistVerification } from '../../../hooks/useArtistVerification';
import { useAuth } from '../../../contexts/AuthContext';
import { uploadImageToCloudinary } from '../../../utils/cloudinary';
import { notifyNewListing } from '../../../utils/notifications';

interface ItemFormData {
  title: string;
  description: string;
  price: string;
  quantity: string;
  category: string;
}

const CATEGORIES = [
  'Painting',
  'Drawing & Illustration',
  'Weaving & Textiles',
  'Wood Craft',
  'Sculpture',
  'Other',
];

export default function ListingItems() {
  const { user } = useAuth();
  const { canCreate, isPending, blockMessage } = useArtistVerification();
  const [gateVisible, setGateVisible] = useState(false);

  useEffect(() => {
    if (!canCreate) setGateVisible(true);
  }, [canCreate]);

  const [formData, setFormData] = useState<ItemFormData>({
    title: '',
    description: '',
    price: '',
    quantity: '1',
    category: '',
  });
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  const compressAndUpload = async (uri: string): Promise<string> => {
    const manipResult = await manipulateAsync(
      uri,
      [{ resize: { width: 1000 } }],
      { compress: 0.8, format: SaveFormat.JPEG }
    );
    return await uploadImageToCloudinary(manipResult.uri, 'listings');
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Please allow access to your photos'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: false,
      allowsEditing: true,
      quality: 0.7,
    });
    if (!result.canceled && result.assets) {
      try {
        setUploading(true);
        const url = await compressAndUpload(result.assets[0].uri);
        setImages([...images, url].slice(0, 5));
      } catch { Alert.alert('Error', 'Failed to upload image. Check your internet connection.'); }
      finally { setUploading(false); }
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Please allow access to your camera'); return; }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8, allowsEditing: true });
    if (!result.canceled && result.assets) {
      try {
        setUploading(true);
        const url = await compressAndUpload(result.assets[0].uri);
        setImages([...images, url].slice(0, 5));
      } catch { Alert.alert('Error', 'Failed to upload image. Check your internet connection.'); }
      finally { setUploading(false); }
    }
  };

  const removeImage = (index: number) => setImages(images.filter((_, i) => i !== index));

  const handleSubmit = async () => {
    if (!canCreate) { setGateVisible(true); return; }
    if (!user) { Alert.alert('Error', 'You must be logged in to create a listing'); return; }
    if (!formData.title || !formData.description || !formData.price || !formData.category) {
      Alert.alert('Error', 'Please fill in all required fields'); return;
    }
    if (images.length === 0) { Alert.alert('Error', 'Please add at least one image'); return; }

    setUploading(true);
    try {
      const quantity = parseInt(formData.quantity);
      const listingData = {
        artistId: user.uid,
        artistEmail: user.email,
        title: formData.title,
        description: formData.description,
        price: parseFloat(formData.price),
        category: formData.category,
        imageUrl: images[0],
        images,
        initialQuantity: quantity,
        currentQuantity: quantity,
        soldCount: 0,
        saves: 0,
        views: 0,
        shares: 0,
        status: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, 'listings'), listingData);

      try {
        const { getDocs, query, where } = await import('firebase/firestore');
        const followersSnap = await getDocs(query(collection(db, 'following'), where('artistId', '==', user.uid)));
        const artistName = user.displayName || user.email?.split('@')[0] || 'An artist';
        followersSnap.docs.forEach(async (followerDoc) => {
          await notifyNewListing(followerDoc.data().userId, artistName, user.uid, formData.title, docRef.id, images[0]);
        });
      } catch {}

      Alert.alert('Success!', 'Your item has been listed on the marketplace!', [{
        text: 'OK',
        onPress: () => {
          setFormData({ title: '', description: '', price: '', quantity: '1', category: '' });
          setImages([]);
          router.replace('/(app)/marketplace/artist-marketplace');
        },
      }]);
    } catch {
      Alert.alert('Error', 'Failed to create listing. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAF7F2" />

      {/* ── Top bar ── */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Feather name="arrow-left" size={20} color="#2A1005" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Header ── */}
        <View style={styles.headerSection}>
          <Text style={styles.title}>List Your Item</Text>
          <Text style={styles.subtitle}>Create your marketplace listing</Text>
        </View>

        {/* ── Photos ── */}
        <View style={styles.section}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>Photos</Text>
            <Text style={styles.labelMeta}>{images.length} / 5</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoRow}>
            {images.map((uri, index) => (
              <View key={index} style={styles.photoThumb}>
                <Image source={{ uri }} style={styles.photoImage} />
                <TouchableOpacity style={styles.photoRemove} onPress={() => removeImage(index)} disabled={uploading}>
                  <Feather name="x" size={12} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
            {images.length < 5 && (
              <>
                <TouchableOpacity style={styles.photoAdd} onPress={pickImage} disabled={uploading} activeOpacity={0.7}>
                  <Feather name="image" size={22} color="#9B8265" />
                  <Text style={styles.photoAddText}>Gallery</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.photoAdd} onPress={takePhoto} disabled={uploading} activeOpacity={0.7}>
                  <Feather name="camera" size={22} color="#9B8265" />
                  <Text style={styles.photoAddText}>Camera</Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </View>

        {/* ── Title ── */}
        <View style={styles.section}>
          <Text style={styles.label}>Item Title <Text style={styles.required}>*</Text></Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Abstract Canvas Painting"
            placeholderTextColor="#C4AFA5"
            value={formData.title}
            onChangeText={(text) => setFormData({ ...formData, title: text })}
            editable={!uploading}
          />
        </View>

        {/* ── Description ── */}
        <View style={styles.section}>
          <Text style={styles.label}>Description <Text style={styles.required}>*</Text></Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Describe your artwork: materials, dimensions, inspiration…"
            placeholderTextColor="#C4AFA5"
            multiline
            numberOfLines={4}
            value={formData.description}
            onChangeText={(text) => setFormData({ ...formData, description: text })}
            editable={!uploading}
            textAlignVertical="top"
          />
        </View>

        {/* ── Price & Quantity ── */}
        <View style={styles.row}>
          <View style={[styles.section, styles.rowItem]}>
            <Text style={styles.label}>Price (₱) <Text style={styles.required}>*</Text></Text>
            <TextInput
              style={styles.input}
              placeholder="0"
              placeholderTextColor="#C4AFA5"
              keyboardType="number-pad"
              value={formData.price}
              maxLength={9}
              onChangeText={(text) => setFormData({ ...formData, price: text.replace(/[^0-9]/g, '') })}
              editable={!uploading}
            />
          </View>
          <View style={[styles.section, styles.rowItem]}>
            <Text style={styles.label}>Quantity <Text style={styles.required}>*</Text></Text>
            <TextInput
              style={styles.input}
              placeholder="1"
              placeholderTextColor="#C4AFA5"
              keyboardType="number-pad"
              value={formData.quantity}
              maxLength={3}
              onChangeText={(text) => setFormData({ ...formData, quantity: text.replace(/[^0-9]/g, '') })}
              editable={!uploading}
            />
          </View>
        </View>

        {/* ── Category ── */}
        <View style={styles.section}>
          <Text style={styles.label}>Category <Text style={styles.required}>*</Text></Text>
          <View style={styles.chips}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[styles.chip, formData.category === cat && styles.chipActive]}
                onPress={() => setFormData({ ...formData, category: cat })}
                disabled={uploading}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, formData.category === cat && styles.chipTextActive]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Submit ── */}
        <TouchableOpacity
          style={[styles.submitBtn, (uploading || !canCreate) && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={uploading}
          activeOpacity={0.8}
        >
          {uploading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.submitText}>{canCreate ? 'List Item' : 'Verification Required'}</Text>
          }
        </TouchableOpacity>
      </ScrollView>

      <VerificationGateModal
        visible={gateVisible}
        onClose={() => { setGateVisible(false); router.back(); }}
        title={blockMessage.title}
        message={blockMessage.message}
        actionLabel={blockMessage.actionLabel}
        actionRoute={blockMessage.actionRoute}
        isPending={isPending}
      />
    </SafeAreaView>
  );
}

// ── Styles ──
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background.primary,
  },

  // Top bar
  topBar: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border.light,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 48 },

  // Header
  headerSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 28,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: COLORS.text.primary,
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: COLORS.text.secondary,
  },

  // Section
  section: {
    marginBottom: 22,
    paddingHorizontal: 20,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text.primary,
    marginBottom: 10,
    letterSpacing: 0.1,
  },
  labelMeta: {
    fontSize: 13,
    color: COLORS.text.secondary,
    fontWeight: '500',
  },
  required: {
    color: COLORS.primary.deepRed,
  },

  // Photos
  photoRow: {
    gap: 10,
    paddingBottom: 4,
  },
  photoThumb: {
    position: 'relative',
    width: 90,
    height: 90,
    borderRadius: 14,
    overflow: 'hidden',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  photoRemove: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoAdd: {
    width: 90,
    height: 90,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.border.light,
    borderStyle: 'dashed',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  photoAddText: {
    fontSize: 11,
    color: COLORS.text.secondary,
    fontWeight: '600',
  },

  // Inputs
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: COLORS.border.light,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: COLORS.text.primary,
  },
  textArea: {
    height: 110,
    paddingTop: 14,
  },

  // Row (price + qty)
  row: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    marginBottom: 0,
  },
  rowItem: {
    flex: 1,
    paddingHorizontal: 0,
  },

  // Category chips
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border.light,
    backgroundColor: '#fff',
  },
  chipActive: {
    backgroundColor: COLORS.primary.deepRed,
    borderColor: COLORS.primary.deepRed,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.text.secondary,
  },
  chipTextActive: {
    color: '#fff',
    fontWeight: '700',
  },

  // Submit
  submitBtn: {
    marginHorizontal: 20,
    marginTop: 8,
    backgroundColor: COLORS.primary.deepRed,
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
  },
  submitBtnDisabled: {
    backgroundColor: COLORS.button.disabled,
  },
  submitText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.3,
  },
});
