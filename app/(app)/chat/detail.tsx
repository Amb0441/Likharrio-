import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useGuardedRouter } from "../../../utils/navigationGuard";
import {
  addDoc, arrayUnion, collection, doc, getDoc, increment,
  onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc,
} from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, Alert, Dimensions, FlatList, Image,
  Keyboard, KeyboardEvent, Platform, StatusBar, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../../contexts/AuthContext";
import { db } from "../../../lib/firebase";
import { notifyNewMessage, notifyNewSale } from "../../../utils/notifications";
import ArtworkDetailsModal from "../../../components/modals/ArtworkDetailsModal";

// ── Constants ──
const { width: SCREEN_WIDTH } = Dimensions.get("window");
const INPUT_BAR_HEIGHT = 64;

// ── Date helpers ──
const getWeekId = (date: Date) => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${week}`;
};

const getWeekStart = (date: Date) => {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay() + (d.getDay() === 0 ? -6 : 1));
  return d;
};

const getWeekEnd = (date: Date) =>
  new Date(getWeekStart(date).getTime() + 6 * 24 * 60 * 60 * 1000);

// ── Types ──
interface Message {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  timestamp: Date;
  read: boolean;
}

interface ListingDetails {
  id: string;
  title: string;
  description: string;
  category: string;
  price: number;
  imageUrl?: string;
  artistId: string;
  artistEmail: string;
  status?: "active" | "sold";
  currentQuantity?: number;
  soldCount?: number;
  initialQuantity?: number;
}

export default function ChatDetailScreen() {
  const { guardedPush, guardedReplace, guardedBack } = useGuardedRouter();
  const { id, participantName, listingTitle, listingId } = useLocalSearchParams();
  const { user, userProfile } = useAuth();
  const flatListRef = useRef<FlatList>(null);
  const insets = useSafeAreaInsets();

  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [listingDetails, setListingDetails] = useState<ListingDetails | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
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

  // ── Load registered name from Firestore ──
  useEffect(() => {
    if (!user) return;
    // Prefer the displayName from AuthContext (already loaded from Firestore)
    if (userProfile?.displayName) {
      setUserName(userProfile.displayName);
      return;
    }
    // Fallback: fetch directly in case userProfile hasn't loaded yet
    getDoc(doc(db, "users", user.uid)).then((snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setUserName(data.displayName || data.name || user.displayName || user.email?.split("@")[0] || "User");
      } else {
        setUserName(user.displayName || user.email?.split("@")[0] || "User");
      }
    });
  }, [user, userProfile]);

  // ── Subscribe to messages & load listing ──
  useEffect(() => {
    if (!user || !id) return;
    if (listingId) fetchListingDetails(listingId as string);
    markMessagesAsRead();
    const unsub = onSnapshot(
      query(collection(db, "chats", id as string, "messages"), orderBy("timestamp", "asc")),
      (snapshot) => {
        setMessages(
          snapshot.docs.map((d) => ({
            id: d.id,
            ...d.data(),
            timestamp: d.data().timestamp?.toDate() || new Date(),
          })) as Message[]
        );
        setLoading(false);
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, [user, id, listingId]);

  // ── Fetch listing details ──
  const fetchListingDetails = async (lid: string) => {
    try {
      const snap = await getDoc(doc(db, "listings", lid));
      if (snap.exists()) setListingDetails({ id: snap.id, ...snap.data() } as ListingDetails);
    } catch {}
  };

  // ── Mark messages as read ──
  const markMessagesAsRead = async () => {
    if (!user || !id) return;
    try {
      await updateDoc(doc(db, "chats", id as string), { [`unread_${user.uid}`]: false });
    } catch {}
  };

  // ── Send message ──
  const sendMessage = async () => {
    if (!messageText.trim() || !user || !id) return;
    setSending(true);
    const trimmed = messageText.trim();
    const resolvedName = userName || user.displayName || user.email?.split("@")[0] || "User";
    setMessageText("");
    try {
      await addDoc(collection(db, "chats", id as string, "messages"), {
        text: trimmed,
        senderId: user.uid,
        senderName: resolvedName,
        timestamp: serverTimestamp(),
        read: false,
      });
      const chatDoc = await getDoc(doc(db, "chats", id as string));
      if (chatDoc.exists()) {
        const data = chatDoc.data();
        const otherUserId = data.participants.find((pid: string) => pid !== user.uid);
        // Patch participantNames so the chat list always shows the correct registered name
        await updateDoc(doc(db, "chats", id as string), {
          lastMessage: trimmed,
          lastMessageTime: serverTimestamp(),
          [`unread_${otherUserId}`]: true,
          [`participantNames.${user.uid}`]: resolvedName,
        });
        if (otherUserId) {
          await notifyNewMessage(
            otherUserId,
            resolvedName,
            user.uid,
            id as string,
            trimmed.substring(0, 50)
          );
        }
      }
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    } catch {}
    finally { setSending(false); }
  };

  // ── Mark as sold ──
  const handleMarkAsSold = async () => {
    if (!listingDetails || !user) return;
    try {
      const snap = await getDoc(doc(db, "listings", listingDetails.id));
      if (!snap.exists()) { Alert.alert("Error", "Listing not found"); return; }
      const data = snap.data();
      const currentQty = data.currentQuantity || 0;
      if (currentQty <= 0) { Alert.alert("Already Sold Out", "No remaining units"); return; }
      const newQty = currentQty - 1;
      const newSoldCount = (data.soldCount || 0) + 1;
      const newStatus = newQty <= 0 ? "sold" : "active";
      Alert.alert(
        "Confirm Sale",
        `Mark 1 unit as sold?\n\n${newQty > 0 ? `${newQty} units will remain.` : "This will mark listing as SOLD OUT."}`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Confirm",
            onPress: async () => {
              try {
                const saleTs = new Date();
                const weekId = getWeekId(saleTs);
                await updateDoc(doc(db, "listings", listingDetails.id), {
                  currentQuantity: newQty,
                  soldCount: newSoldCount,
                  status: newStatus,
                  updatedAt: serverTimestamp(),
                  lastSoldAt: serverTimestamp(),
                  ...(newStatus === "sold" && { soldOutAt: serverTimestamp() }),
                });
                try {
                  await addDoc(collection(db, "saleRecords"), {
                    artistId: listingDetails.artistId,
                    listingId: listingDetails.id,
                    price: listingDetails.price,
                    quantity: 1,
                    totalAmount: listingDetails.price,
                    timestamp: serverTimestamp(),
                    week: weekId,
                    month: saleTs.toISOString().slice(0, 7),
                  });
                } catch {}
                try {
                  const weekRef = doc(db, "analytics", listingDetails.artistId, "weeklySales", weekId);
                  const weekDoc = await getDoc(weekRef);
                  if (weekDoc.exists()) {
                    await updateDoc(weekRef, {
                      totalSales: increment(1),
                      revenue: increment(listingDetails.price),
                      lastUpdated: serverTimestamp(),
                      soldListings: arrayUnion(listingDetails.id),
                    });
                  } else {
                    await setDoc(weekRef, {
                      weekStart: getWeekStart(saleTs).toISOString(),
                      weekEnd: getWeekEnd(saleTs).toISOString(),
                      totalSales: 1,
                      revenue: listingDetails.price,
                      soldListings: [listingDetails.id],
                      createdAt: serverTimestamp(),
                      lastUpdated: serverTimestamp(),
                    });
                  }
                } catch {}
                setListingDetails((prev) =>
                  prev ? { ...prev, currentQuantity: newQty, soldCount: newSoldCount, status: newStatus } : null
                );
                await notifyNewSale(
                  listingDetails.artistId,
                  listingDetails.title,
                  listingDetails.id,
                  user.displayName || user.email?.split("@")[0] || "A buyer",
                  listingDetails.imageUrl
                );
                Alert.alert(
                  "Success!",
                  newQty > 0 ? `Sale recorded! ${newQty} unit(s) remaining.` : "Sale recorded! Listing is now SOLD OUT."
                );
              } catch {
                Alert.alert("Error", "Failed to record sale.");
              }
            },
          },
        ]
      );
    } catch {
      Alert.alert("Error", "Failed to load listing data");
    }
  };

  // ── Helpers ──
  const isArtist = listingDetails?.artistId === user?.uid;

  const formatTime = (date: Date) =>
    date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });

  const formatDateHeader = (date: Date) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const shouldShowDateHeader = (index: number) =>
    index === 0 ||
    messages[index].timestamp.toDateString() !== messages[index - 1].timestamp.toDateString();

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isMe = item.senderId === user?.uid;
    return (
      <View>
        {shouldShowDateHeader(index) && (
          <View style={styles.dateRow}>
            <View style={styles.dateLine} />
            <Text style={styles.dateText}>{formatDateHeader(item.timestamp)}</Text>
            <View style={styles.dateLine} />
          </View>
        )}
        <View style={[styles.msgRow, isMe && styles.msgRowMe]}>
          <View style={[styles.bubble, isMe && styles.bubbleMe]}>
            <Text style={[styles.bubbleText, isMe && styles.bubbleTextMe]}>{item.text}</Text>
            <Text style={[styles.bubbleTime, isMe && styles.bubbleTimeMe]}>
              {formatTime(item.timestamp)}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const bottomOffset = keyboardHeight > 0 ? keyboardHeight : 0;

  // ── Loading state ──
  if (loading) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#8B1A1A" />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => guardedBack()}>
          <Ionicons name="arrow-back" size={20} color="#2A1005" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerName} numberOfLines={1}>{participantName || "Chat"}</Text>
          {listingTitle ? (
            <Text style={styles.headerSub} numberOfLines={1}>{listingTitle as string}</Text>
          ) : null}
        </View>
      </View>

      {/* Listing preview bar */}
      {listingDetails && (
        <View style={styles.listingBar}>
          <TouchableOpacity
            style={styles.listingRow}
            onPress={() => setShowDetailsModal(true)}
            activeOpacity={0.8}
          >
            {listingDetails.imageUrl ? (
              <Image source={{ uri: listingDetails.imageUrl }} style={styles.listingThumb} />
            ) : (
              <View style={[styles.listingThumb, styles.listingThumbEmpty]}>
                <Ionicons name="image-outline" size={18} color="#C8BAA8" />
              </View>
            )}
            {listingDetails.status === "sold" && (
              <View style={styles.soldOverlay}>
                <Text style={styles.soldOverlayText}>SOLD</Text>
              </View>
            )}
            <View style={styles.listingInfo}>
              <Text style={styles.listingTitle} numberOfLines={1}>{listingDetails.title}</Text>
              <Text style={styles.listingPrice}>₱{listingDetails.price.toLocaleString()}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#8B1A1A" />
          </TouchableOpacity>
          {isArtist && listingDetails.status !== "sold" && (listingDetails.currentQuantity || 0) > 0 && (
            <TouchableOpacity style={styles.soldBtn} onPress={handleMarkAsSold}>
              <Ionicons name="checkmark-circle-outline" size={16} color="#fff" />
              <Text style={styles.soldBtnText}>Mark as Sold</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.msgList, { paddingBottom: INPUT_BAR_HEIGHT + 16 }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        style={styles.flex}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
        ListHeaderComponent={
          <View style={styles.disclaimer}>
            <Ionicons name="shield-outline" size={15} color="#8B6914" style={{ marginTop: 1 }} />
            <Text style={styles.disclaimerText}>
              <Text style={styles.disclaimerBold}>Likharrio is not involved in any payment transaction.</Text>
              {" "}All buying and selling arrangements, including payment and delivery, are made directly between the buyer and seller. Proceed at your own discretion.
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="chatbubble-ellipses-outline" size={32} color="#8B1A1A" />
            </View>
            <Text style={styles.emptyTitle}>Start the conversation</Text>
            <Text style={styles.emptySub}>Say hello to begin your chat</Text>
          </View>
        }
      />

      {/* Input bar */}
      <View style={[styles.inputBar, { bottom: bottomOffset }]}>
        <TextInput
          style={styles.input}
          value={messageText}
          onChangeText={setMessageText}
          placeholder="Type a message…"
          placeholderTextColor="#B8A99A"
          multiline
          maxLength={1000}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!messageText.trim() || sending) && styles.sendBtnDisabled]}
          onPress={sendMessage}
          disabled={!messageText.trim() || sending}
        >
          {sending
            ? <ActivityIndicator size="small" color="#fff" />
            : <Ionicons name="send" size={16} color="#fff" />
          }
        </TouchableOpacity>
      </View>

      {/* Artwork details modal */}
      {listingDetails && (
        <ArtworkDetailsModal
          visible={showDetailsModal}
          listing={{
            id: listingDetails.id,
            title: listingDetails.title,
            description: listingDetails.description,
            category: listingDetails.category,
            price: listingDetails.price,
            imageUrl: listingDetails.imageUrl,
            artistId: listingDetails.artistId,
            artistEmail: listingDetails.artistEmail,
            status: listingDetails.status === "sold" ? "sold" : "available",
          }}
          artistName={listingDetails.artistEmail.split("@")[0]}
          isSaved={false}
          onClose={() => setShowDetailsModal(false)}
          onShare={async () => Alert.alert("Share", "Coming soon!")}
          onToggleSave={async () => Alert.alert("Save", "Coming soon!")}
          onContactArtist={() => setShowDetailsModal(false)}
          onReport={() => Alert.alert("Report", "Coming soon!")}
        />
      )}
    </View>
  );
}

// ── Styles ──
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#FAF7F2",
  },
  flex: {
    flex: 1,
  },
  loadingWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
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
  headerInfo: {
    flex: 1,
  },
  headerName: {
    fontSize: 16,
    fontWeight: "800",
    color: "#2A1005",
  },
  headerSub: {
    fontSize: 12,
    color: "#9B8265",
    marginTop: 1,
  },

  // Listing bar
  listingBar: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#EDE0D4",
  },
  listingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  listingThumb: {
    width: 46,
    height: 46,
    borderRadius: 10,
    overflow: "hidden",
    flexShrink: 0,
  },
  listingThumbEmpty: {
    backgroundColor: "#F5EFE8",
    justifyContent: "center",
    alignItems: "center",
  },
  soldOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 46,
    height: 46,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
  },
  soldOverlayText: {
    color: "#fff",
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 1,
  },
  listingInfo: {
    flex: 1,
  },
  listingTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#2A1005",
  },
  listingPrice: {
    fontSize: 13,
    fontWeight: "700",
    color: "#8B1A1A",
    marginTop: 2,
  },
  soldBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#2D5016",
    paddingVertical: 9,
    borderRadius: 10,
    marginTop: 10,
  },
  soldBtnText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },

  // Messages
  msgList: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 14,
  },
  dateLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#EDE0D4",
  },
  dateText: {
    fontSize: 11,
    color: "#9B8265",
    paddingHorizontal: 10,
    fontWeight: "600",
  },
  msgRow: {
    marginVertical: 3,
    alignItems: "flex-start",
  },
  msgRowMe: {
    alignItems: "flex-end",
  },
  bubble: {
    maxWidth: SCREEN_WIDTH * 0.75,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#EDE0D4",
  },
  bubbleMe: {
    backgroundColor: "#8B1A1A",
    borderWidth: 0,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 4,
  },
  bubbleText: {
    fontSize: 15,
    color: "#2A1005",
    lineHeight: 20,
  },
  bubbleTextMe: {
    color: "#fff",
  },
  bubbleTime: {
    fontSize: 10,
    color: "#9B8265",
    marginTop: 4,
  },
  bubbleTimeMe: {
    color: "rgba(255,255,255,0.65)",
    textAlign: "right",
  },

  // Disclaimer
  disclaimer: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#FEF8E7",
    borderWidth: 1,
    borderColor: "#F0D878",
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 11,
    marginBottom: 16,
  },
  disclaimerText: {
    flex: 1,
    fontSize: 12,
    color: "#7A5C14",
    lineHeight: 17,
  },
  disclaimerBold: {
    fontWeight: "700",
    color: "#5C4210",
  },

  // Empty state
  emptyWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 80,
    gap: 10,
  },
  emptyIconWrap: {
    width: 68,
    height: 68,
    borderRadius: 20,
    backgroundColor: "rgba(139,26,26,0.08)",
    justifyContent: "center",
    alignItems: "center",
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#2A1005",
  },
  emptySub: {
    fontSize: 13,
    color: "#9B8265",
  },

  // Input bar
  inputBar: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    borderTopWidth: 1,
    borderTopColor: "#EDE0D4",
    backgroundColor: "#FAF7F2",
  },
  input: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: "#2A1005",
    maxHeight: 100,
    borderWidth: 1.5,
    borderColor: "#EDE0D4",
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#8B1A1A",
    justifyContent: "center",
    alignItems: "center",
  },
  sendBtnDisabled: {
    backgroundColor: "#D0C4B8",
  },
});
