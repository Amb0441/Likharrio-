import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { deleteDoc, doc, getDoc, updateDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { ImageStyle, TextStyle, ViewStyle } from 'react-native';

type PortfolioEditStyles = {
  container: ViewStyle;
  loadingContainer: ViewStyle;
  header: ViewStyle;
  headerTitle: TextStyle;
  saveButton: TextStyle;
  content: ViewStyle;
  previewSection: ViewStyle;
  previewImage: ImageStyle;
  previewInfo: ViewStyle;
  previewCount: TextStyle;
  previewNote: TextStyle;
  inputSection: ViewStyle;
  inputLabel: TextStyle;
  titleInput: TextStyle;
  descriptionInput: TextStyle;
  characterCount: TextStyle;
  optionItem: ViewStyle;
  optionLeft: ViewStyle;
  optionLabel: TextStyle;
  optionRight: ViewStyle;
  optionValue: TextStyle;
  optionPlaceholder: TextStyle;
  tagsInput: TextStyle;
  dangerZone: ViewStyle;
  dangerZoneTitle: TextStyle;
  deleteButton: ViewStyle;
  deleteButtonText: TextStyle;
  dangerZoneNote: TextStyle;
  modalOverlay: ViewStyle;
  modalContent: ViewStyle;
  modalHandle: ViewStyle;
  modalTitle: TextStyle;
  categoryOption: ViewStyle;
  categoryOptionText: TextStyle;
  categoryOptionTextActive: TextStyle;
};
import { SafeAreaView } from 'react-native-safe-area-context';
import COLORS from '../../../constants/Colors';
import { useAuth } from '../../../contexts/AuthContext';
import { db } from '../../../lib/firebase';

interface PortfolioData {
  id: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  coverImage: string;
  images: string[];
  artistId: string;
}

export default function EditPortfolio() {
  const { user } = useAuth();
  const { id } = useLocalSearchParams();
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    tags: '',
  });

  const categories = [
    { id: 'painting', label: 'Painting', icon: 'brush' },
    { id: 'drawing-illustration', label: 'Drawing & Illustration', icon: 'pencil' },
    { id: 'weaving-textiles', label: 'Weaving & Textiles', icon: 'grid' },
    { id: 'wood-craft', label: 'Wood Craft', icon: 'leaf' },
    { id: 'sculpture', label: 'Sculpture', icon: 'cube' },
    { id: 'other', label: 'Other', icon: 'ellipsis-horizontal' },
  ];

  useEffect(() => {
    if (id) {
      fetchPortfolio();
    }
  }, [id]);

  const fetchPortfolio = async () => {
    try {
      const docRef = doc(db, 'portfolios', id as string);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data() as Omit<PortfolioData, 'id'>;
        
        const portfolioData = { id: docSnap.id, ...data };
        setPortfolio(portfolioData);
        
        setFormData({
          title: data.title,
          description: data.description,
          category: data.category,
          tags: data.tags.join(', '),
        });
      } else {
        Alert.alert('Error', 'Portfolio not found');
        router.back();
      }
    } catch (error) {
      console.error('Error fetching portfolio:', error);
      Alert.alert('Error', 'Failed to load portfolio');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user || !portfolio) return;

    if (portfolio.artistId !== user.uid) {
      Alert.alert('Error', 'You can only edit your own portfolio');
      return;
    }

    if (!formData.title.trim()) {
      Alert.alert('Error', 'Please add a title');
      return;
    }

    if (!formData.description.trim()) {
      Alert.alert('Error', 'Please add a description');
      return;
    }

    if (!formData.category) {
      Alert.alert('Error', 'Please select a category');
      return;
    }

    setSaving(true);

    try {
      const portfolioRef = doc(db, 'portfolios', portfolio.id);
      await updateDoc(portfolioRef, {
        title: formData.title.trim(),
        description: formData.description.trim(),
        category: formData.category,
        tags: formData.tags.split(',').map(tag => tag.trim()).filter(tag => tag),
        updatedAt: new Date(),
      });

      Alert.alert('Success', 'Portfolio updated successfully', [
        {
          text: 'OK',
          onPress: () => router.back(),
        }
      ]);
    } catch (error) {
      console.error('Error updating portfolio:', error);
      Alert.alert('Error', 'Failed to update portfolio');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Portfolio',
      'Are you sure you want to delete this portfolio? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: confirmDelete,
        }
      ]
    );
  };

  const confirmDelete = async () => {
    if (!user || !portfolio) return;

    if (portfolio.artistId !== user.uid) {
      Alert.alert('Error', 'You can only delete your own portfolio');
      return;
    }

    setDeleting(true);

    try {
      const portfolioRef = doc(db, 'portfolios', portfolio.id);
      await deleteDoc(portfolioRef);

      Alert.alert('Deleted', 'Portfolio deleted successfully', [
        {
          text: 'OK',
          onPress: () => {
            router.back();
            router.back(); // Go back twice to return to profile
          },
        }
      ]);
    } catch (error) {
      console.error('Error deleting portfolio:', error);
      Alert.alert('Error', 'Failed to delete portfolio');
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary.deepRed} />
        </View>
      </SafeAreaView>
    );
  }

  if (!portfolio) {
    return null;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="close" size={28} color={COLORS.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Portfolio</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving}>
          {saving ? (
            <ActivityIndicator size="small" color={COLORS.primary.deepRed} />
          ) : (
            <Text style={styles.saveButton}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Preview Image */}
        <View style={styles.previewSection}>
          <Image
            source={{ uri: portfolio.coverImage }}
            style={styles.previewImage}
          />
          <View style={styles.previewInfo}>
            <Text style={styles.previewCount}>
              {portfolio.images.length} {portfolio.images.length === 1 ? 'photo' : 'photos'}
            </Text>
            <Text style={styles.previewNote}>Images cannot be changed</Text>
          </View>
        </View>

        {/* Title Input */}
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>Title *</Text>
          <TextInput
            style={styles.titleInput}
            placeholder="Add a title..."
            placeholderTextColor={COLORS.text.muted}
            value={formData.title}
            onChangeText={(text) => setFormData({ ...formData, title: text })}
            editable={!saving && !deleting}
            maxLength={80}
          />
          <Text style={styles.characterCount}>
            {formData.title.length}/80
          </Text>
        </View>

        {/* Description Input */}
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>Description *</Text>
          <TextInput
            style={styles.descriptionInput}
            placeholder="Write a description..."
            placeholderTextColor={COLORS.text.muted}
            multiline
            numberOfLines={4}
            value={formData.description}
            onChangeText={(text) => setFormData({ ...formData, description: text })}
            editable={!saving && !deleting}
            maxLength={500}
          />
          <Text style={styles.characterCount}>
            {formData.description.length}/500
          </Text>
        </View>

        {/* Category Selection */}
        <TouchableOpacity
          style={styles.optionItem}
          onPress={() => setShowCategoryModal(true)}
          disabled={saving || deleting}
        >
          <View style={styles.optionLeft}>
            <Ionicons name="grid-outline" size={24} color={COLORS.text.secondary} />
            <Text style={styles.optionLabel}>Category *</Text>
          </View>
          <View style={styles.optionRight}>
            {formData.category ? (
              <Text style={styles.optionValue}>
                {categories.find(c => c.id === formData.category)?.label}
              </Text>
            ) : (
              <Text style={styles.optionPlaceholder}>Select</Text>
            )}
            <Ionicons name="chevron-forward" size={20} color={COLORS.text.muted} />
          </View>
        </TouchableOpacity>

        {/* Tags Input */}
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>Tags</Text>
          <TextInput
            style={styles.tagsInput}
            placeholder="Add tags (separate with commas)"
            placeholderTextColor={COLORS.text.muted}
            value={formData.tags}
            onChangeText={(text) => setFormData({ ...formData, tags: text })}
            editable={!saving && !deleting}
          />
        </View>

        {/* Delete Button */}
        <View style={styles.dangerZone}>
          <Text style={styles.dangerZoneTitle}>Danger Zone</Text>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={handleDelete}
            disabled={saving || deleting}
          >
            {deleting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="trash-outline" size={20} color="#fff" />
                <Text style={styles.deleteButtonText}>Delete Portfolio</Text>
              </>
            )}
          </TouchableOpacity>
          <Text style={styles.dangerZoneNote}>
            This action cannot be undone. All likes, views, and associated data will be permanently deleted.
          </Text>
        </View>
      </ScrollView>

      {/* Category Modal */}
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
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Select Category</Text>
            <ScrollView>
              {categories.map((category) => (
                <TouchableOpacity
                  key={category.id}
                  style={styles.categoryOption}
                  onPress={() => {
                    setFormData({ ...formData, category: category.id });
                    setShowCategoryModal(false);
                  }}
                >
                  <Ionicons
                    name={category.icon as any}
                    size={24}
                    color={
                      formData.category === category.id
                        ? COLORS.primary.deepRed
                        : COLORS.text.secondary
                    }
                  />
                  <Text
                    style={[
                      styles.categoryOptionText,
                      formData.category === category.id && styles.categoryOptionTextActive
                    ]}
                  >
                    {category.label}
                  </Text>
                  {formData.category === category.id && (
                    <Ionicons name="checkmark" size={24} color={COLORS.primary.deepRed} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create<PortfolioEditStyles>({
  container: {
    flex: 1,
    backgroundColor: COLORS.background.primary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.light,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  saveButton: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primary.deepRed,
  },
  content: {
    flex: 1,
  },
  previewSection: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.light,
    gap: 12,
  },
  previewImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  previewInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  previewCount: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: 4,
  },
  previewNote: {
    fontSize: 12,
    color: COLORS.text.muted,
  },
  inputSection: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.light,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text.secondary,
    marginBottom: 8,
  },
  titleInput: {
    fontSize: 16,
    color: COLORS.text.primary,
    fontWeight: '500',
  },
  descriptionInput: {
    fontSize: 15,
    color: COLORS.text.primary,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  characterCount: {
    fontSize: 12,
    color: COLORS.text.muted,
    textAlign: 'right',
    marginTop: 4,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.light,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  optionLabel: {
    fontSize: 16,
    color: COLORS.text.primary,
  },
  optionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  optionValue: {
    fontSize: 15,
    color: COLORS.text.primary,
  },
  optionPlaceholder: {
    fontSize: 15,
    color: COLORS.text.muted,
  },
  tagsInput: {
    fontSize: 15,
    color: COLORS.text.primary,
  },
  dangerZone: {
    margin: 16,
    padding: 16,
    backgroundColor: '#FFF5F5',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FEE',
  },
  dangerZoneTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.status.error.text,
    marginBottom: 12,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.status.error.bg,
    paddingVertical: 14,
    borderRadius: 8,
    marginBottom: 8,
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  dangerZoneNote: {
    fontSize: 12,
    color: COLORS.text.secondary,
    lineHeight: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.background.primary,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 32,
    maxHeight: '70%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.border.light,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text.primary,
    textAlign: 'center',
    marginBottom: 16,
  },
  categoryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.light,
  },
  categoryOptionText: {
    flex: 1,
    fontSize: 16,
    color: COLORS.text.primary,
  },
  categoryOptionTextActive: {
    color: COLORS.primary.deepRed,
    fontWeight: '600',
  },
});
