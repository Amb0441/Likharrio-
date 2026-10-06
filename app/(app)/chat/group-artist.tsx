import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useGuardedRouter } from "../../../utils/navigationGuard";
import {
  addDoc, arrayRemove, arrayUnion, collection, doc, getDoc,
  limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc,
} from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import {
  Alert, FlatList, Keyboard, KeyboardEvent, Modal,
  Platform, Pressable, ScrollView, StatusBar, StyleSheet,
  Text, TouchableOpacity, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { db } from "../../../lib/firebase";
import { useAuth } from "../../../contexts/AuthContext";

// ── Types ──
interface Message {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  timestamp: Date;
}

interface Community {
  id: string;
  name: string;
  icon: string;
  color: string;
  memberCount: number;
  joined: boolean;
}

// ── Constants ──
const ALL_COMMUNITIES = [
  { id: "painting",  name: "Painting",               icon: "color-palette",       color: "#C9413E" },
  { id: "drawing",   name: "Drawing & Illustration",  icon: "pencil",              color: "#2D7D6F" },
  { id: "textile",   name: "Weaving & Textiles",      icon: "shirt",               color: "#C48A1A" },
  { id: "woodcraft", name: "Wood Craft",              icon: "leaf",                color: "#7B5230" },
  { id: "sculpture", name: "Sculpture",               icon: "cube",                color: "#7B52AB" },
  { id: "other",     name: "Other",                   icon: "ellipsis-horizontal", color: "#6B5946" },
];

export default function GroupArtistChat() {
  const router = useRouter();
  const { guardedPush, guardedReplace } = useGuardedRouter();
  const { user } = useAuth();
  const flatListRef = useRef<FlatList>(null);

  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [communities, setCommunities] = useState<Community[]>(
    ALL_COMMUNITIES.map((c) => ({ ...c, memberCount: 0, joined: false }))
  );
  const [activeCommunity, setActiveCommunity] = useState<Community | null>(null);
  const [showChatModal, setShowChatModal] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [userName, setUserName] = useState("");

  // ── Keyboard listeners ──
  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      (e: KeyboardEvent) => {
        setKeyboardHeight(e.endCoordinates.height);
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      }
    );
    const hide = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => setKeyboardHeight(0)
    );
    return () => { show.remove(); hide.remove(); };
  }, []);

  // ── Load user name ──
  useEffect(() => {
    if (!user) return;
    getDoc(doc(db, "users", user.uid)).then((snap) => {
      if (snap.exists()) setUserName(snap.data().name || "Artist");
    });
  }, [user]);

  // ── Load all communities with joined status ──
  useEffect(() => {
    if (!user) return;
    (async () => {
      const results: Community[] = [];
      for (const c of ALL_COMMUNITIES) {
        try {
          const snap = await getDoc(doc(db, "groupChats", `artists_${c.id}`));
          const memberCount = snap.exists() ? (snap.data().members || []).length : 0;
          const joined = snap.exists() && (snap.data().members || []).includes(user.uid);
          results.push({ ...c, memberCount, joined });
        } catch {
          results.push({ ...c, memberCount: 0, joined: false });
        }
      }
      results.sort((a, b) => (a.joined === b.joined ? 0 : a.joined ? -1 : 1));
      setCommunities(results);
    })();
  }, [user]);

  // ── Subscribe to active community messages ──
  useEffect(() => {
    if (!user || !activeCommunity) { setMessages([]); return; }
    setLoading(true);
    const unsub = onSnapshot(
      query(
        collection(db, "groupChats", `artists_${activeCommunity.id}`, "messages"),
        orderBy("timestamp", "desc"),
        limit(100)
      ),
      (snap) => {
        setMessages(
          snap.docs.map((d) => ({
            id: d.id,
            text: d.data().text,
            senderId: d.data().senderId,
            senderName: d.data().senderName,
            timestamp: d.data().timestamp?.toDate() || new Date(),
          })).reverse()
        );
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, [user, activeCommunity]);

  // ── Join community ──
  const handleJoinCommunity = async (community: Community) => {
    if (!user) return;
    try {
      const ref = doc(db, "groupChats", `artists_${community.id}`);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        await updateDoc(ref, { members: arrayUnion(user.uid) });
      } else {
        await setDoc(ref, { members: [user.uid], name: community.name, createdAt: serverTimestamp() });
      }
      setCommunities((prev) =>
        prev
          .map((c) =>
            c.id === community.id
              ? { ...c, joined: true, memberCount: snap.exists() ? (snap.data().members?.length || 0) + 1 : 1 }
              : c
          )
          .sort((a, b) => (a.joined === b.joined ? 0 : a.joined ? -1 : 1))
      );
      Alert.alert("Joined!", `You're now in ${community.name}`);
    } catch {
      Alert.alert("Error", "Failed to join. Please try again.");
    }
  };

  // ── Leave community ──
  const handleLeaveCommunity = (community: Community) => {
    Alert.alert("Leave Community", `Leave ${community.name}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Leave",
        style: "destructive",
        onPress: async () => {
          if (!user) return;
          try {
            await updateDoc(doc(db, "groupChats", `artists_${community.id}`), {
              members: arrayRemove(user.uid),
            });
            setCommunities((prev) =>
              prev
                .map((c) =>
                  c.id === community.id
                    ? { ...c, joined: false, memberCount: Math.max(0, c.memberCount - 1) }
                    : c
                )
                .sort((a, b) => (a.joined === b.joined ? 0 : a.joined ? -1 : 1))
            );
            if (activeCommunity?.id === community.id) {
              setActiveCommunity(null);
              setShowChatModal(false);
            }
          } catch {
            Alert.alert("Error", "Failed to leave.");
          }
        },
      },
    ]);
  };

  // ── Open chat for a community ──
  const handleOpenChat = (community: Community) => {
    if (!community.joined) {
      handleJoinCommunity(community);
      return;
    }
    guardedPush({
      pathname: "/(app)/chat/group-chat",
      params: {
        communityId: community.id,
        communityName: community.name,
        communityColor: community.color,
        communityIcon: community.icon,
        userType: "artist",
      },
    });
  };

  // ── Send message ──
  const handleSend = async () => {
    if (!newMessage.trim() || !user || !activeCommunity) return;
    setSending(true);
    const trimmed = newMessage.trim();
    setNewMessage("");
    try {
      await addDoc(
        collection(db, "groupChats", `artists_${activeCommunity.id}`, "messages"),
        { text: trimmed, senderId: user.uid, senderName: userName || "Artist", timestamp: serverTimestamp() }
      );
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    } catch {}
    finally { setSending(false); }
  };

  // ── Render community item ──
  const renderCommunity = ({ item }: { item: Community }) => (
    <TouchableOpacity
      style={styles.communityCard}
      onPress={() => handleOpenChat(item)}
      onLongPress={() => item.joined && handleLeaveCommunity(item)}
      activeOpacity={0.8}
    >
      <View style={[styles.communityIconWrap, { backgroundColor: item.color }]}>
        <Ionicons name={item.icon as any} size={22} color="#fff" />
      </View>
      <View style={styles.communityInfo}>
        <Text style={styles.communityName}>{item.name}</Text>
        <Text style={styles.communityMeta}>{item.memberCount} members</Text>
      </View>
      {item.joined ? (
        <View style={styles.chatBadge}>
          <Ionicons name="chatbubble-ellipses" size={14} color="#fff" />
          <Text style={styles.chatBadgeText}>Chat</Text>
        </View>
      ) : (
        <View style={styles.joinBadge}>
          <Ionicons name="add" size={14} color="#fff" />
          <Text style={styles.joinBadgeText}>Join</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color="#2A1005" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Artist Communities</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Communities list */}
      <FlatList
        data={communities}
        keyExtractor={(item) => item.id}
        renderItem={renderCommunity}
        contentContainerStyle={styles.listPad}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <Text style={styles.sectionLabel}>
            {communities.filter((c) => c.joined).length > 0
              ? "YOUR COMMUNITIES"
              : "AVAILABLE COMMUNITIES"}
          </Text>
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="people-outline" size={32} color="#8B1A1A" />
            </View>
            <Text style={styles.emptyTitle}>Loading Communities...</Text>
            <Text style={styles.emptySub}>Please wait while we load available groups</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

// ── Styles ──
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#FAF7F2",
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#EDE0D4",
    backgroundColor: "#FAF7F2",
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#EDE0D4",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#2A1005",
  },
  headerSpacer: {
    width: 36,
  },

  listPad: {
    padding: 20,
    gap: 10,
  },

  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#9B8265",
    letterSpacing: 1,
    marginBottom: 4,
  },

  communityCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#EDE0D4",
  },
  communityIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  communityInfo: {
    flex: 1,
  },
  communityName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#2A1005",
    marginBottom: 3,
  },
  communityMeta: {
    fontSize: 12,
    color: "#9B8265",
  },

  chatBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#2D5016",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  chatBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#fff",
  },

  joinBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#8B1A1A",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  joinBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#fff",
  },

  emptyWrap: {
    alignItems: "center",
    paddingTop: 60,
    gap: 10,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: "rgba(139,26,26,0.08)",
    justifyContent: "center",
    alignItems: "center",
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#2A1005",
  },
  emptySub: {
    fontSize: 13,
    color: "#9B8265",
    textAlign: "center",
    lineHeight: 20,
  },
});
