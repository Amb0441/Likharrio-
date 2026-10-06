import { Feather } from "@expo/vector-icons";
import { useGuardedRouter } from "../../../utils/navigationGuard";
import * as ImagePicker from "expo-image-picker";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { uploadImageToCloudinary } from "../../../utils/cloudinary";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../../contexts/AuthContext";
import { useLayoutMode } from "../../../hooks/useLayoutMode";
import { db } from "../../../lib/firebase";
import COLORS from "../../../constants/Colors";
import ProfileHeader, {
  type ArtistProfileData,
} from "../../../components/profile/ProfileHeader";
import ProfileEditModal from "../../../components/profile/ProfileEditModal";
import AboutLikharrioModal from "../../../components/modals/AboutLikharrioModal";

interface ArtworkItem {
  id: string;
  title: string;
  artistId: string;
  artistName: string;
  likes: number;
  views: number;
  imageUrl: string;
  type: "portfolio" | "product";
  price?: number;
  currentQuantity?: number;
  soldCount?: number;
  status?: string;
  createdAt: string;
}

export default function ArtistProfile() {
  const { user, userProfile, signOut } = useAuth();
  const router = useRouter();
  const { isWebsite } = useLayoutMode();

  const { guardedPush } = useGuardedRouter();
  const [activeTab, setActiveTab] = useState<
    "portfolio" | "products"
  >("portfolio");
  const [profile, setProfile] =
    useState<ArtistProfileData | null>(null);
  const [portfolio, setPortfolio] = useState<ArtworkItem[]>([]);
  const [products, setProducts] = useState<ArtworkItem[]>([]);
  const [followersCount, setFollowersCount] = useState(0);
  const [totalLikes, setTotalLikes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isNavigating, setIsNavigating] = useState(false);
  const [referralCode, setReferralCode] =
    useState<string | null>(null);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [editName, setEditName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editArtistType, setEditArtistType] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const portfolioScrollRef = useRef<ScrollView>(null);
  const productsScrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const unsubUser = onSnapshot(
      doc(db, "users", user.uid),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setProfile(data as ArtistProfileData);
        }
      },
    );

    const unsubFollowers = onSnapshot(
      query(
        collection(db, "following"),
        where("artistId", "==", user.uid),
      ),
      (snap) => setFollowersCount(snap.size),
    );

    return () => {
      unsubUser();
      unsubFollowers();
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    getDocs(
      query(
        collection(db, "notifications"),
        where("userId", "==", user.uid),
        where("read", "==", false),
      ),
    ).then((s) => setUnreadCount(s.size));
  }, [user]);

  useEffect(() => {
    if (profile) {
      setEditName(profile.name || "");
      setEditBio(profile.bio || "");
      setEditArtistType(profile.artistType || "Painter");
      setReferralCode(profile.referralCode || null);
    }
  }, [profile]);

  useEffect(() => {
    if (activeTab === "portfolio") {
      portfolioScrollRef.current?.scrollTo({
        x: 0,
        animated: false,
      });
    } else {
      productsScrollRef.current?.scrollTo({
        x: 0,
        animated: false,
      });
    }
  }, [activeTab]);

  const handleItemPress = (item: ArtworkItem) => {
    if (isNavigating) return;
    setIsNavigating(true);
    try {
      if (item.type === "portfolio") {
        guardedPush({
          pathname: "/(app)/showcase/showcase-detail",
          params: { id: item.id },
        });
      } else {
        guardedPush({
          pathname: "/(app)/marketplace/listing-details",
          params: { id: item.id },
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setTimeout(() => setIsNavigating(false), 1500);
    }
  };

  useEffect(() => {
    if (!user) return;
    const artistName =
      profile?.name ||
      user.email?.split("@")[0] ||
      "Artist";
    const q = query(
      collection(db, "portfolios"),
      where("artistId", "==", user.uid),
      orderBy("createdAt", "desc"),
    );
    const unsub = onSnapshot(q, (snap) => {
      const items = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          title: data.title,
          artistId: data.artistId,
          artistName,
          likes: data.likes || 0,
          views: data.views || 0,
          imageUrl:
            data.coverImage || data.images?.[0] || "",
          type: "portfolio" as const,
          createdAt: data.createdAt,
        };
      });
      setPortfolio(items);
      setTotalLikes(
        items.reduce((sum, item) => sum + (item.likes || 0), 0),
      );
    });
    return () => unsub();
  }, [user, profile?.name]);

  const fetchData = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const artistName =
        profile?.name ||
        user.email?.split("@")[0] ||
        "Artist";

      const productsSnap = await getDocs(
        query(
          collection(db, "listings"),
          where("artistId", "==", user.uid),
          where("status", "==", "active"),
          orderBy("createdAt", "desc"),
        ),
      );
      setProducts(
        productsSnap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            title: data.title,
            artistId: data.artistId,
            artistName,
            likes: data.saves || 0,
            views: data.views || 0,
            imageUrl:
              data.imageUrl || data.images?.[0] || "",
            type: "product" as const,
            price: data.price,
            currentQuantity: data.currentQuantity || 0,
            soldCount: data.soldCount || 0,
            status: data.status,
            createdAt: data.createdAt,
          };
        }),
      );
    } catch (e) {
      console.error("Failed to load profile data", e);
      Alert.alert(
        "Error",
        "Failed to load profile data",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const generateReferralCode = async () => {
    if (!user) return;
    if (referralCode) {
      Alert.alert(
        "Your Referral Code",
        referralCode,
        [
          {
            text: "Copy",
            onPress: () =>
              Clipboard.setStringAsync(referralCode),
          },
          { text: "OK" },
        ],
      );
      return;
    }
    setGeneratingCode(true);
    try {
      const code = `LKHR-${user.uid
        .substring(0, 4)
        .toUpperCase()}-${Math.floor(
        1000 + Math.random() * 9000,
      )}`;
      await updateDoc(doc(db, "users", user.uid), {
        referralCode: code,
      });
      setReferralCode(code);
      setProfile((prev) =>
        prev ? { ...prev, referralCode: code } : null,
      );
      Alert.alert(
        "Code Generated! 🎉",
        `Your code:\n\n${code}`,
        [
          {
            text: "Copy",
            onPress: () =>
              Clipboard.setStringAsync(code),
          },
          { text: "OK" },
        ],
      );
    } catch (e) {
      console.error(
        "Failed to generate referral code",
        e,
      );
      Alert.alert(
        "Error",
        "Failed to generate referral code.",
      );
    } finally {
      setGeneratingCode(false);
    }
  };

  const handlePickProfileImage = async () => {
    const { status } =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission needed",
        "Please allow access to your photo library.",
      );
      return;
    }
    const result =
      await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });
    if (
      result.canceled ||
      !result.assets?.[0]?.uri ||
      !user
    )
      return;
    setUploadingImage(true);
    try {
      const compressed = await manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 400 } }],
        {
          compress: 0.85,
          format: SaveFormat.JPEG,
        },
      );
      const downloadURL =
        await uploadImageToCloudinary(
          compressed.uri,
          "profiles",
        );
      await updateDoc(doc(db, "users", user.uid), {
        profileImage: downloadURL,
      });
      setProfile((prev) =>
        prev
          ? { ...prev, profileImage: downloadURL }
          : null,
      );
    } catch (e) {
      console.error(
        "Failed to upload profile picture",
        e,
      );
      Alert.alert(
        "Error",
        "Failed to upload profile picture.",
      );
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    if (!editName.trim()) {
      Alert.alert(
        "Error",
        "Artist Name cannot be empty",
      );
      return;
    }
    setSaving(true);
    try {
      await updateDoc(doc(db, "users", user.uid), {
        name: editName.trim(),
        bio: editBio.trim(),
        artistType: editArtistType,
      });
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              name: editName.trim(),
              bio: editBio.trim(),
              artistType: editArtistType,
            }
          : null,
      );
      setShowEditModal(false);
      Alert.alert(
        "Success",
        "Profile updated successfully",
      );
    } catch (e) {
      console.error("Failed to update profile", e);
      Alert.alert(
        "Error",
        "Failed to update profile",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      "Logout",
      "Are you sure you want to logout?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Logout",
          style: "destructive",
          onPress: async () => {
            try {
              await signOut();
              router.replace("/(auth)/welcome");
            } catch (e) {
              console.error(e);
            }
          },
        },
      ],
    );
  };

  const openEditModal = () => {
    setEditName(profile?.name || "");
    setEditBio(profile?.bio || "");
    setEditArtistType(
      profile?.artistType || "Painter",
    );
    setShowEditModal(true);
  };

  const renderArtworkCard = (item: ArtworkItem) => (
    <TouchableOpacity
      key={item.id}
      style={styles.artworkCard}
      onPress={() => handleItemPress(item)}
      disabled={isNavigating}
      activeOpacity={0.75}
    >
      <Image
        source={{
          uri:
            item.imageUrl ||
            "https://via.placeholder.com/400x300",
        }}
        style={styles.artworkImage}
      />
        {item.type === "product" && (
          <View style={styles.stockBadge}>
            <Text style={styles.stockBadgeText}>
              {item.currentQuantity || 0} left
            </Text>
          </View>
        )}
      <View style={styles.artworkInfo}>
        <View style={styles.artworkTitleRow}>
          <Text
            style={styles.artworkTitle}
            numberOfLines={1}
          >
            {item.title}
          </Text>
          <View style={styles.artworkStats}>
            <View style={styles.artworkStat}>
              <Feather
                name="heart"
                size={12}
                color={COLORS.primary.deepRed}
              />
              <Text style={styles.artworkStatText}>
                {item.likes}
              </Text>
            </View>
            <View style={styles.artworkStat}>
              <Feather
                name="eye"
                size={12}
                color={COLORS.text.muted}
              />
              <Text style={styles.artworkStatText}>
                {item.views}
              </Text>
            </View>
          </View>
        </View>
        {item.type === "product" &&
          typeof item.price === "number" && (
            <Text style={styles.priceText}>
              ₱{item.price.toLocaleString()}
            </Text>
          )}
        {item.type === "product" &&
          item.soldCount !== undefined && (
            <View style={styles.artworkStat}>
              <Feather
                name="shopping-bag"
                size={12}
                color={COLORS.text.muted}
              />
              <Text style={styles.artworkStatText}>
                {item.soldCount} sold
              </Text>
            </View>
          )}
        <TouchableOpacity
          style={styles.viewBtn}
          onPress={() => handleItemPress(item)}
          disabled={isNavigating}
        >
          <Text style={styles.viewBtnText}>View</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.root} edges={["top"]}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator
            size="large"
            color={COLORS.primary.deepRed}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={isWebsite ? [] : ["top"]}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={COLORS.background.primary}
      />

      {!isWebsite && <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={openEditModal}
        >
          <Feather
            name="edit-2"
            size={18}
            color={COLORS.text.primary}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() =>
            guardedPush("/(app)/notifications")
          }
        >
          <Feather
            name="bell"
            size={18}
            color={COLORS.text.primary}
          />
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {unreadCount > 99
                  ? "99+"
                  : unreadCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, isWebsite && styles.webPage]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchData();
            }}
            tintColor={COLORS.primary.deepRed}
          />
        }
      >
        <ProfileHeader
          profile={profile}
          artistStatus={userProfile?.artistStatus ?? null}
          followersCount={followersCount}
          totalLikes={totalLikes}
          portfolioCount={portfolio.length}
          productsCount={products.length}
          uploadingImage={uploadingImage}
          onPickImage={handlePickProfileImage}
          onNavigateToVerification={() =>
            guardedPush(
              "/(app)/artist/artist-verification" as any,
            )
          }
        />

        <View style={styles.tabsRow}>
          {(["portfolio", "products"] as const).map(
            (tab) => (
              <TouchableOpacity
                key={tab}
                style={[
                  styles.tab,
                  activeTab === tab && styles.tabActive,
                ]}
                onPress={() => setActiveTab(tab)}
              >
                <Text
                  style={[
                    styles.tabText,
                    activeTab === tab &&
                      styles.tabTextActive,
                  ]}
                >
                  {tab === "portfolio"
                    ? `Showcase (${portfolio.length})`
                    : `Products (${products.length})`}
                </Text>
              </TouchableOpacity>
            ),
          )}
        </View>

        <View style={styles.tabContent}>
          {activeTab === "portfolio" ? (
            portfolio.length > 0 ? (
              <ScrollView
                ref={portfolioScrollRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={
                  styles.artworkScroll
                }
              >
                {portfolio.map(renderArtworkCard)}
              </ScrollView>
            ) : (
              <View style={styles.emptyState}>
                <Feather
                  name="image"
                  size={40}
                  color={COLORS.text.placeholder}
                />
                <Text style={styles.emptyTitle}>
                  No showcase items yet
                </Text>
                <Text style={styles.emptySub}>
                  Add your first artwork to get started
                </Text>
              </View>
            )
          ) : products.length > 0 ? (
            <ScrollView
              ref={productsScrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={
                styles.artworkScroll
              }
            >
              {products.map(renderArtworkCard)}
            </ScrollView>
          ) : (
            <View style={styles.emptyState}>
              <Feather
                name="tag"
                size={40}
                color={COLORS.text.placeholder}
              />
              <Text style={styles.emptyTitle}>
                No products yet
              </Text>
              <Text style={styles.emptySub}>
                List your first item on the marketplace
              </Text>
            </View>
          )}
        </View>

        <View style={styles.menuSection}>
          <Text style={styles.menuLabel}>ACCOUNT</Text>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={openEditModal}
          >
            <View style={styles.menuIconBox}>
              <Feather
                name="user"
                size={16}
                color={COLORS.primary.deepRed}
              />
            </View>
            <Text style={styles.menuItemText}>
              Edit Profile
            </Text>
            <Feather
              name="chevron-right"
              size={16}
              color={COLORS.text.placeholder}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.menuItem,
              !profile?.verified && { opacity: 0.45 },
            ]}
            onPress={() => {
              if (!profile?.verified) {
                Alert.alert(
                  "Verification Required",
                  "Your referral code is locked until your " +
                    "artist account is verified. Complete the " +
                    "verification process to unlock this feature.",
                  [{ text: "OK" }],
                );
                return;
              }
              generateReferralCode();
            }}
            disabled={generatingCode}
          >
            <View
              style={[
                styles.menuIconBox,
                !profile?.verified && {
                  backgroundColor:
                    COLORS.badge.background,
                },
              ]}
            >
              <Feather
                name={
                  profile?.verified ? "gift" : "lock"
                }
                size={16}
                color={
                  profile?.verified
                    ? COLORS.primary.deepRed
                    : COLORS.text.placeholder
                }
              />
            </View>
            <View style={styles.menuItemBody}>
              <Text style={styles.menuItemText}>
                My Referral Code
              </Text>
              {!profile?.verified ? (
                <Text style={styles.menuItemSub}>
                  Verified artists only
                </Text>
              ) : referralCode ? (
                <Text style={styles.referralCode}>
                  {referralCode}
                </Text>
              ) : (
                <Text style={styles.menuItemSub}>
                  Tap to generate your permanent code
                </Text>
              )}
            </View>
            {generatingCode ? (
              <ActivityIndicator
                size="small"
                color={COLORS.primary.deepRed}
              />
            ) : !profile?.verified ? (
              <Feather
                name="lock"
                size={16}
                color={COLORS.text.placeholder}
              />
            ) : referralCode ? (
              <TouchableOpacity
                onPress={() =>
                  Clipboard.setStringAsync(
                    referralCode!,
                  )
                }
              >
                <Feather
                  name="copy"
                  size={16}
                  color={COLORS.primary.deepRed}
                />
              </TouchableOpacity>
            ) : (
              <Feather
                name="chevron-right"
                size={16}
                color={COLORS.text.placeholder}
              />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() =>
              guardedPush({
                pathname: "/(app)/faq",
                params: { role: "artist" },
              } as any)
            }
          >
            <View style={styles.menuIconBox}>
              <Feather
                name="help-circle"
                size={16}
                color={COLORS.primary.deepRed}
              />
            </View>
            <Text style={styles.menuItemText}>FAQ</Text>
            <Feather
              name="chevron-right"
              size={16}
              color={COLORS.text.placeholder}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, { borderBottomWidth: 0 }]}
            onPress={() => setShowAboutModal(true)}
          >
            <View style={styles.menuIconBox}>
              <Feather
                name="info"
                size={16}
                color={COLORS.primary.deepRed}
              />
            </View>
            <Text style={styles.menuItemText}>
              About Likharrio
            </Text>
            <Feather
              name="chevron-right"
              size={16}
              color={COLORS.text.placeholder}
            />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <Feather
            name="log-out"
            size={16}
            color={COLORS.primary.deepRed}
          />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>

      <ProfileEditModal
        visible={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSave={handleSaveProfile}
        editName={editName}
        setEditName={setEditName}
        editBio={editBio}
        setEditBio={setEditBio}
        editArtistType={editArtistType}
        setEditArtistType={setEditArtistType}
        saving={saving}
      />

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
    backgroundColor: COLORS.background.primary,
  },
  loadingWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  webPage: {
    width: "100%",
    maxWidth: 1100,
    alignSelf: "center",
    paddingBottom: 48,
  },
  scrollContent: {
    paddingBottom: 48,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: COLORS.border.primary,
    backgroundColor: COLORS.text.white,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  badge: {
    position: "absolute",
    top: -2,
    right: -2,
    backgroundColor: COLORS.primary.deepRed,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 3,
  },
  badgeText: {
    color: COLORS.text.white,
    fontSize: 9,
    fontWeight: "800",
  },
  tabsRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.primary,
    marginTop: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary.deepRed,
  },
  tabText: {
    fontSize: 14,
    color: COLORS.text.muted,
    fontWeight: "600",
  },
  tabTextActive: {
    color: COLORS.primary.deepRed,
    fontWeight: "700",
  },
  tabContent: {
    paddingVertical: 16,
    minHeight: 160,
  },
  artworkScroll: {
    paddingHorizontal: 20,
    gap: 12,
  },
  artworkCard: {
    width: 160,
    height: 270,
    backgroundColor: COLORS.text.white,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORS.border.primary,
    shadowColor: COLORS.text.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  artworkImage: {
    width: "100%",
    height: 160,
    backgroundColor: COLORS.background.secondary,
  },
  stockBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: COLORS.overlay.dark,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  stockBadgeText: {
    color: COLORS.text.white,
    fontSize: 10,
    fontWeight: "600",
  },
  artworkInfo: {
    padding: 10,
    minHeight: 90,
    justifyContent: "space-between",
  },
  artworkTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 3,
  },
  artworkTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.text.primary,
    flex: 1,
    marginRight: 6,
  },
  priceText: {
    fontSize: 13,
    fontWeight: "800",
    color: COLORS.primary.deepRed,
    marginBottom: 4,
  },
  artworkStats: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    flexShrink: 0,
  },
  artworkStat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  artworkStatText: {
    fontSize: 11,
    color: COLORS.text.muted,
  },
  viewBtn: {
    backgroundColor: COLORS.primary.deepRed,
    borderRadius: 8,
    paddingVertical: 6,
    alignItems: "center",
  },
  viewBtnText: {
    fontSize: 12,
    color: COLORS.text.white,
    fontWeight: "700",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.text.primary,
  },
  emptySub: {
    fontSize: 13,
    color: COLORS.text.muted,
  },
  menuSection: {
    paddingHorizontal: 20,
    marginTop: 24,
  },
  menuLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.text.muted,
    marginBottom: 12,
    letterSpacing: 1.5,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.primary,
  },
  menuIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: COLORS.background.tertiary,
    borderWidth: 1,
    borderColor: COLORS.border.secondary,
    alignItems: "center",
    justifyContent: "center",
  },
  menuItemBody: {
    flex: 1,
  },
  menuItemText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text.primary,
  },
  menuItemSub: {
    fontSize: 12,
    color: COLORS.text.muted,
    marginTop: 2,
  },
  referralCode: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.primary.deepRed,
    letterSpacing: 1,
    marginTop: 2,
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginHorizontal: 20,
    marginTop: 28,
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.border.primary,
    backgroundColor: COLORS.text.white,
  },
  logoutText: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.primary.deepRed,
  },
});
