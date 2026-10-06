import { Feather } from "@expo/vector-icons";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AboutLikharrioModal from "../../../components/modals/AboutLikharrioModal";
import { useAuth } from "../../../contexts/AuthContext";
import { useLayoutMode } from "../../../hooks/useLayoutMode";
import { db } from "../../../lib/firebase";
import { uploadImageToCloudinary } from "../../../utils/cloudinary";
import { useGuardedRouter } from "../../../utils/navigationGuard";

const ART_CATEGORIES = ['Painting', 'Drawing & Illustration', 'Weaving & Textiles', 'Wood Craft', 'Sculpture', 'Other'];

const STAT_CARDS = [
  { key: 'likes', label: 'Liked Art', icon: 'heart', color: '#8B1A1A', bg: '#FEF1EB' },
  { key: 'saved', label: 'Saved', icon: 'bookmark', color: '#2B5EA7', bg: '#EEF4FC' },
  { key: 'following', label: 'Following', icon: 'users', color: '#2D5016', bg: '#E8F5E9' },
  { key: 'viewed', label: 'Viewed', icon: 'eye', color: '#7B3FA0', bg: '#F4EEF8' },
] as const;

const LIST_ICON_MAP: Record<string, { icon: string; color: string; bg: string }> = {
  portfolio: { icon: 'image', color: '#8B1A1A', bg: '#FEF1EB' },
  listing: { icon: 'tag', color: '#2B5EA7', bg: '#EEF4FC' },
  artist: { icon: 'user', color: '#2D5016', bg: '#E8F5E9' },
  event: { icon: 'calendar', color: '#7B3FA0', bg: '#F4EEF8' },
};

interface UserProfile {
  uid: string;
  email: string;
  role: string;
  verified: boolean;
  createdAt: string;
  name?: string;
  bio?: string;
  profileImage?: string;
  artPreferences?: string[];
}

interface EnthusiastStats {
  likes: number;
  saved: number;
  following: number;
  viewed: number;
}

interface ListItem {
  id: string;
  title: string;
  subtitle: string;
  type: 'portfolio' | 'listing' | 'artist' | 'event';
}

export default function Profile() {
  const { guardedPush, guardedReplace, guardedBack } = useGuardedRouter();
  const { user, isGuestMode, setGuestMode, signOut } = useAuth();
  const router = useRouter();
  const { isWebsite, width } = useLayoutMode();
  const wideProfile = isWebsite && width >= 960;

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editInterests, setEditInterests] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [stats, setStats] = useState<EnthusiastStats>({ likes: 0, saved: 0, following: 0, viewed: 0 });
  const [loadingStats, setLoadingStats] = useState(true);
  const [showListModal, setShowListModal] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [listType, setListType] = useState<'likes' | 'saved' | 'following' | 'viewed' | null>(null);
  const [listData, setListData] = useState<ListItem[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // ── Guest redirect ──
  useEffect(() => {
    if (isGuestMode) {
      Alert.alert(
        'Profile Not Available',
        'Please sign in or create an account to access your profile',
        [
          { text: 'Sign In', onPress: () => { setGuestMode(false); guardedReplace('/(auth)/login'); } },
          { text: 'Sign Up', onPress: () => { setGuestMode(false); guardedReplace('/(auth)/role-selection'); } },
          { text: 'Go Back', onPress: () => guardedBack(), style: 'cancel' },
        ],
      );
      return;
    }
    if (user) fetchProfileData();
  }, [user, isGuestMode]);

  // ── Sync edit fields when profile changes ──
  useEffect(() => {
    if (profile) {
      setEditName(profile.name || '');
      setEditBio(profile.bio || '');
      setEditInterests(profile.artPreferences || []);
    }
  }, [profile]);

  // ── Stats subscriptions ──
  useEffect(() => {
    if (!user) return;

    const unsubLikes = onSnapshot(
      query(collection(db, 'likes'), where('userId', '==', user.uid)),
      (s) => setStats((p) => ({ ...p, likes: s.size })),
    );
    const unsubSaved = onSnapshot(
      query(collection(db, 'saved'), where('userId', '==', user.uid)),
      (s) => setStats((p) => ({ ...p, saved: s.size })),
    );
    const unsubFollowing = onSnapshot(
      query(collection(db, 'following'), where('userId', '==', user.uid)),
      (s) => setStats((p) => ({ ...p, following: s.size })),
    );
    const unsubViewed = onSnapshot(
      query(collection(db, 'views'), where('userId', '==', user.uid)),
      (s) => {
        setStats((p) => ({ ...p, viewed: s.size }));
        setLoadingStats(false);
      },
    );

    getDocs(
      query(
        collection(db, 'notifications'),
        where('userId', '==', user.uid),
        where('read', '==', false),
      ),
    ).then((s) => setUnreadCount(s.size));

    return () => {
      unsubLikes();
      unsubSaved();
      unsubFollowing();
      unsubViewed();
    };
  }, [user]);

  // ── Fetch profile ──
  const fetchProfileData = async () => {
    try {
      const d = await getDoc(doc(db, 'users', user!.uid));
      if (d.exists()) setProfile(d.data() as UserProfile);
    } catch {
      console.error('Error fetching profile');
    } finally {
      setLoading(false);
    }
  };

  // ── Change profile photo ──
  const handleChangeProfilePhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photos');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });
    if (!result.canceled && result.assets[0]) {
      try {
        setUploadingPhoto(true);
        // Compress before upload: resize to 400px (profile avatar size) and apply smart compression
        const compressed = await manipulateAsync(
          result.assets[0].uri,
          [{ resize: { width: 400 } }],
          { compress: 0.85, format: SaveFormat.JPEG }
        );
        const url = await uploadImageToCloudinary(compressed.uri, 'profiles');
        await updateDoc(doc(db, 'users', user!.uid), { profileImage: url });
        setProfile((prev) => (prev ? { ...prev, profileImage: url } : null));
      } catch {
        Alert.alert('Error', 'Failed to upload photo.');
      } finally {
        setUploadingPhoto(false);
      }
    }
  };

  // ── Open stat list ──
  const handleOpenList = async (type: 'likes' | 'saved' | 'following' | 'viewed') => {
    setListType(type);
    setShowListModal(true);
    setLoadingList(true);
    setListData([]);

    try {
      let data: ListItem[] = [];

      if (type === 'likes') {
        const snap = await getDocs(
          query(collection(db, 'likes'), where('userId', '==', user!.uid)),
        );
        const results = await Promise.all(
          snap.docs.map(async (d) => {
            const pd = await getDoc(doc(db, 'portfolios', d.data().targetId));
            if (!pd.exists()) return null;
            return {
              id: pd.id,
              title: pd.data().title || 'Untitled',
              subtitle: `by ${pd.data().artistEmail?.split('@')[0] || 'Artist'}`,
              type: 'portfolio' as const,
            };
          }),
        );
        data = results.filter(Boolean) as ListItem[];

      } else if (type === 'saved') {
        const snap = await getDocs(
          query(collection(db, 'saved'), where('userId', '==', user!.uid)),
        );
        const results = await Promise.all(
          snap.docs.map(async (d) => {
            const { targetId, type: t } = d.data();
            const ref = doc(db, t === 'portfolio' ? 'portfolios' : 'listings', targetId);
            const pd = await getDoc(ref);
            if (!pd.exists()) return null;
            return {
              id: pd.id,
              title: pd.data().title || 'Untitled',
              subtitle: t === 'portfolio' ? 'Artwork' : `₱${pd.data().price?.toLocaleString() || 'TBD'}`,
              type: t as any,
            };
          }),
        );
        data = results.filter(Boolean) as ListItem[];

      } else if (type === 'following') {
        const snap = await getDocs(
          query(collection(db, 'following'), where('userId', '==', user!.uid)),
        );
        const results = await Promise.all(
          snap.docs.map(async (d) => {
            const ud = await getDoc(doc(db, 'users', d.data().artistId));
            if (!ud.exists()) return null;
            return {
              id: ud.id,
              title: ud.data().name || 'Unknown Artist',
              subtitle: 'Artist',
              type: 'artist' as const,
            };
          }),
        );
        data = results.filter(Boolean) as ListItem[];

      } else if (type === 'viewed') {
        const snap = await getDocs(
          query(collection(db, 'views'), where('userId', '==', user!.uid)),
        );
        const results = await Promise.all(
          snap.docs.map(async (d) => {
            const { targetId, type: t } = d.data();
            const ref = doc(db, t === 'portfolio' ? 'portfolios' : 'listings', targetId);
            const pd = await getDoc(ref);
            if (!pd.exists()) return null;
            return {
              id: pd.id,
              title: pd.data().title || 'Untitled',
              subtitle: 'Artwork',
              type: t as any,
            };
          }),
        );
        data = results.filter(Boolean) as ListItem[];
      }

      setListData(data);
    } catch {
      Alert.alert('Error', 'Could not load details.');
    } finally {
      setLoadingList(false);
    }
  };

  // ── Handle list item press ──
  const handleItemPress = (item: ListItem) => {
    setShowListModal(false);
    switch (item.type) {
      case 'portfolio':
        guardedPush({ pathname: '/(app)/showcase/showcase-detail', params: { id: item.id } });
        break;
      case 'listing':
        guardedPush({ pathname: '/(app)/marketplace/enthusiast-marketplace', params: { selectedListingId: item.id } });
        break;
      case 'artist':
        guardedPush({ pathname: '/(app)/artist/artist-profile-view', params: { id: item.id } });
        break;
      case 'event':
        guardedPush({ pathname: '/(app)/events/event-detail', params: { id: item.id } });
        break;
    }
  };

  // ── Toggle interest ──
  const toggleInterest = (art: string) => {
    setEditInterests((prev) =>
      prev.includes(art) ? prev.filter((i) => i !== art) : [...prev, art],
    );
  };

  // ── Save profile ──
  const handleSaveProfile = async () => {
    if (!user) return;
    if (!editName.trim()) { Alert.alert('Error', 'Name cannot be empty'); return; }
    if (editInterests.length === 0) { Alert.alert('Error', 'Please select at least one interest'); return; }

    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        name: editName.trim(),
        bio: editBio.trim(),
        artPreferences: editInterests,
      });
      setProfile((prev) =>
        prev ? { ...prev, name: editName.trim(), bio: editBio.trim(), artPreferences: editInterests } : null,
      );
      setShowEditModal(false);
      Alert.alert('Success', 'Profile updated successfully');
    } catch {
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  // ── Logout ──
  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
            router.replace("/(auth)/welcome");
          } catch { }
        },
      },
    ]);
  };

  const getListTitle = () =>
    ({ likes: 'Liked Artworks', saved: 'Saved Items', following: 'Following', viewed: 'Recently Viewed' }[listType!] || 'List');

  // ── Loading state ──
  if (loading) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#8B1A1A" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={isWebsite ? [] : ['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAF7F2" />

      {!isWebsite && <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => guardedPush('/(app)/notifications')}
          >
            <Feather name="bell" size={18} color="#2A1005" />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>}

      <ScrollView contentContainerStyle={isWebsite ? styles.webPage : styles.scrollContent} showsVerticalScrollIndicator={false}>
        {isWebsite && <Text style={styles.webTitle}>Profile</Text>}
        <View style={wideProfile ? styles.webLayout : undefined}>
        <View style={wideProfile ? styles.webMain : undefined}>

        {/* Profile section */}
        <View style={[styles.profileSection, isWebsite && styles.profileSectionWeb]}>
          <TouchableOpacity
            style={styles.avatarWrap}
            onPress={handleChangeProfilePhoto}
            disabled={uploadingPhoto}
            activeOpacity={0.85}
          >
            {profile?.profileImage ? (
              <Image source={{ uri: profile.profileImage }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarInitial}>
                  {(profile?.name || profile?.email || 'U').charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.cameraBtn}>
              {uploadingPhoto ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Feather name="camera" size={13} color="#fff" />
              )}
            </View>
          </TouchableOpacity>

          <Text style={styles.name}>{profile?.name || 'Set your name'}</Text>
          <Text style={styles.email}>{profile?.email}</Text>
          {profile?.bio && <Text style={styles.bio}>{profile.bio}</Text>}

          <View style={styles.rolePill}>
            <Text style={styles.roleText}>ENTHUSIAST</Text>
          </View>

          {profile?.artPreferences && profile.artPreferences.length > 0 && (
            <View style={styles.interestsWrap}>
              <Text style={styles.interestsLabel}>Interests</Text>
              <View style={styles.interestChips}>
                {profile.artPreferences.map((art) => (
                  <View key={art} style={styles.interestChip}>
                    <Text style={styles.interestChipText}>{art}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>

        </View>
        <View style={wideProfile ? styles.webAside : undefined}>
        {/* Stats */}
        {loadingStats ? (
          <View style={styles.statsLoadingWrap}>
            <ActivityIndicator size="small" color="#8B1A1A" />
            <Text style={styles.statsLoadingText}>Syncing stats…</Text>
          </View>
        ) : (
          <View style={styles.statsGrid}>
            {STAT_CARDS.map((s) => (
              <TouchableOpacity
                key={s.key}
                style={styles.statCard}
                onPress={() => handleOpenList(s.key)}
                activeOpacity={0.75}
              >
                <View style={[styles.statIconBox, { backgroundColor: s.bg }]}>
                  <Feather name={s.icon} size={18} color={s.color} />
                </View>
                <Text style={styles.statValue}>{stats[s.key]}</Text>
                <Text style={styles.statLabel}>{s.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Menu */}
        <View style={styles.menuSection}>
          <Text style={styles.menuLabel}>DISCOVER</Text>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => guardedPush('/(app)/enthusiast/recommendations')}
          >
            <View style={styles.menuIconBox}>
              <Feather name="star" size={16} color="#8B1A1A" />
            </View>
            <Text style={styles.menuItemText}>For You</Text>
            <Feather name="chevron-right" size={16} color="#C8BAA8" />
          </TouchableOpacity>
        </View>

        <View style={styles.menuSection}>
          <Text style={styles.menuLabel}>ACCOUNT</Text>
          <TouchableOpacity style={styles.menuItem} onPress={() => setShowEditModal(true)}>
            <View style={styles.menuIconBox}>
              <Feather name="user" size={16} color="#8B1A1A" />
            </View>
            <Text style={styles.menuItemText}>Edit Profile</Text>
            <Feather name="chevron-right" size={16} color="#C8BAA8" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => guardedPush({ pathname: '/(app)/faq', params: { role: 'enthusiast' } } as any)}
          >
            <View style={styles.menuIconBox}>
              <Feather name="help-circle" size={16} color="#8B1A1A" />
            </View>
            <Text style={styles.menuItemText}>FAQ</Text>
            <Feather name="chevron-right" size={16} color="#C8BAA8" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, { borderBottomWidth: 0 }]}
            onPress={() => setShowAboutModal(true)}
          >
            <View style={styles.menuIconBox}>
              <Feather name="info" size={16} color="#8B1A1A" />
            </View>
            <Text style={styles.menuItemText}>About Likharrio</Text>
            <Feather name="chevron-right" size={16} color="#C8BAA8" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
          <Feather name="log-out" size={16} color="#8B1A1A" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        <View style={styles.bottomSpacer} />
        </View>
        </View>
      </ScrollView>

      {/* Edit modal */}
      <Modal
        visible={showEditModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowEditModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowEditModal(false)}>
                <Feather name="x" size={16} color="#2A1005" />
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={styles.modalBody}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.fieldSection}>
                <Text style={styles.fieldLabel}>Display Name</Text>
                <TextInput
                  style={styles.input}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Enter your name"
                  placeholderTextColor="#C4AFA5"
                />
              </View>

              <View style={styles.fieldSection}>
                <Text style={styles.fieldLabel}>Bio</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={editBio}
                  onChangeText={setEditBio}
                  placeholder="Tell us about yourself…"
                  placeholderTextColor="#C4AFA5"
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>

              <View style={styles.fieldSection}>
                <Text style={styles.fieldLabel}>
                  Interests{' '}
                  <Text style={styles.fieldLabelSub}>(tap to toggle)</Text>
                </Text>
                <View style={styles.chips}>
                  {ART_CATEGORIES.map((art) => (
                    <TouchableOpacity
                      key={art}
                      style={[styles.chip, editInterests.includes(art) && styles.chipActive]}
                      onPress={() => toggleInterest(art)}
                    >
                      <Text style={[styles.chipText, editInterests.includes(art) && styles.chipTextActive]}>
                        {art}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <TouchableOpacity
                style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                onPress={handleSaveProfile}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveBtnText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* List modal */}
      <Modal
        visible={showListModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowListModal(false)}
      >
        <SafeAreaView style={styles.listModal}>
          <View style={styles.listModalHeader}>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowListModal(false)}>
              <Feather name="x" size={16} color="#2A1005" />
            </TouchableOpacity>
            <Text style={styles.listModalTitle}>{getListTitle()}</Text>
            <View style={styles.listModalSpacer} />
          </View>

          {loadingList ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color="#8B1A1A" />
            </View>
          ) : listData.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Feather name="inbox" size={40} color="#C8BAA8" />
              <Text style={styles.emptyTitle}>No items found</Text>
            </View>
          ) : (
            <FlatList
              data={listData}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => {
                const ic = LIST_ICON_MAP[item.type] || { icon: 'circle', color: '#9B8265', bg: '#F5F1E8' };
                return (
                  <TouchableOpacity
                    style={styles.listItem}
                    onPress={() => handleItemPress(item)}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.listIconBox, { backgroundColor: ic.bg }]}>
                      <Feather name={ic.icon as any} size={18} color={ic.color} />
                    </View>
                    <View style={styles.listItemText}>
                      <Text style={styles.listItemTitle} numberOfLines={1}>{item.title}</Text>
                      <Text style={styles.listItemSub}>{item.subtitle}</Text>
                    </View>
                    <Feather name="chevron-right" size={16} color="#C8BAA8" />
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </SafeAreaView>
      </Modal>

      <AboutLikharrioModal
        visible={showAboutModal}
        onClose={() => setShowAboutModal(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FAF7F2',
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingBottom: 24,
  },
  webPage: {
    width: "100%",
    maxWidth: 1100,
    alignSelf: "center",
    paddingHorizontal: 28,
    paddingTop: 28,
    paddingBottom: 48,
  },
  webTitle: {
    fontSize: 32,
    fontWeight: "800",
    color: "#2A1005",
    letterSpacing: -0.6,
    marginBottom: 20,
  },
  webLayout: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 20,
  },
  webMain: {
    flex: 1.15,
    backgroundColor: "#fff",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#EDE0D4",
    padding: 28,
  },
  webAside: {
    flex: 0.85,
    gap: 16,
  },
  profileSectionWeb: {
    alignItems: "flex-start",
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 0,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#EDE0D4',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#2A1005',
    letterSpacing: -0.3,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: '#EDE0D4',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#8B1A1A',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
  },

  // Profile section
  profileSection: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 20,
  },
  avatarWrap: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 3,
    borderColor: '#EDE0D4',
  },
  avatarFallback: {
    backgroundColor: '#FDF5F2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontSize: 34,
    fontWeight: '800',
    color: '#8B1A1A',
  },
  cameraBtn: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#8B1A1A',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FAF7F2',
  },
  name: {
    fontSize: 20,
    fontWeight: '800',
    color: '#2A1005',
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  email: {
    fontSize: 13,
    color: '#9B8265',
    marginBottom: 10,
  },
  bio: {
    fontSize: 14,
    color: '#6B5946',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 12,
    paddingHorizontal: 20,
    fontStyle: 'italic',
  },
  rolePill: {
    backgroundColor: '#FDF5F2',
    borderWidth: 1,
    borderColor: '#F0DDD8',
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 16,
  },
  roleText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8B1A1A',
    letterSpacing: 1,
  },
  interestsWrap: {
    alignItems: 'center',
    width: '100%',
  },
  interestsLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9B8265',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  interestChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  interestChip: {
    backgroundColor: '#FDF5F2',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#F0DDD8',
  },
  interestChipText: {
    fontSize: 12,
    color: '#8B1A1A',
    fontWeight: '600',
  },

  // Stats
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 8,
  },
  statCard: {
    width: '47%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#EDE0D4',
    shadowColor: '#2A1005',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#2A1005',
  },
  statLabel: {
    fontSize: 12,
    color: '#9B8265',
    fontWeight: '500',
  },
  statsLoadingWrap: {
    paddingVertical: 32,
    alignItems: 'center',
    gap: 10,
  },
  statsLoadingText: {
    fontSize: 13,
    color: '#9B8265',
  },

  // Menu
  menuSection: {
    paddingHorizontal: 20,
    marginTop: 20,
  },
  menuLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9B8265',
    marginBottom: 12,
    letterSpacing: 1.5,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#EDE0D4',
  },
  menuIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#FDF5F2',
    borderWidth: 1,
    borderColor: '#F0DDD8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuItemText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#2A1005',
  },

  // Logout
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginTop: 28,
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#EDE0D4',
    backgroundColor: '#fff',
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#8B1A1A',
  },

  bottomSpacer: {
    height: 40,
  },

  // Edit modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FAF7F2',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
  },
  modalHandle: {
    width: 36,
    height: 4,
    backgroundColor: '#EDE0D4',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#EDE0D4',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#2A1005',
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EDE0D4',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: {
    padding: 20,
    gap: 4,
    paddingBottom: 40,
  },
  fieldSection: {
    marginBottom: 18,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2A1005',
    marginBottom: 10,
  },
  fieldLabelSub: {
    fontSize: 12,
    fontWeight: '400',
    color: '#9B8265',
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#EDE0D4',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#2A1005',
  },
  textArea: {
    height: 100,
    paddingTop: 14,
  },
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
    borderColor: '#EDE0D4',
    backgroundColor: '#fff',
  },
  chipActive: {
    backgroundColor: '#8B1A1A',
    borderColor: '#8B1A1A',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B5946',
  },
  chipTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  saveBtn: {
    backgroundColor: '#8B1A1A',
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 8,
  },
  saveBtnDisabled: {
    backgroundColor: '#C4AFA5',
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
  },

  // List modal
  listModal: {
    flex: 1,
    backgroundColor: '#FAF7F2',
  },
  listModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#EDE0D4',
  },
  listModalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#2A1005',
  },
  listModalSpacer: {
    width: 32,
  },
  listContent: {
    padding: 20,
    gap: 12,
  },
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  emptyTitle: {
    fontSize: 15,
    color: '#9B8265',
    fontWeight: '600',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#EDE0D4',
  },
  listIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  listItemText: {
    flex: 1,
  },
  listItemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2A1005',
    marginBottom: 3,
  },
  listItemSub: {
    fontSize: 12,
    color: '#9B8265',
  },
});
