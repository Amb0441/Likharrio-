import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  addDoc, collection, doc, getDoc, limit,
  onSnapshot, orderBy, query, serverTimestamp, updateDoc,
} from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, Dimensions, FlatList, Keyboard, KeyboardEvent,
  Platform, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../../contexts/AuthContext";
import { db } from "../../../lib/firebase";

// ── Constants ──
const { width: SCREEN_WIDTH } = Dimensions.get("window");
const INPUT_BAR_HEIGHT = 64;

// ── Types ──
interface Message {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  timestamp: Date;
}

export default function GroupChatScreen() {
  const router = useRouter();
  const { communityId, communityName, communityColor, communityIcon, userType } =
    useLocalSearchParams<{
      communityId: string;
      communityName: string;
      communityColor: string;
      communityIcon: string;
      userType: string;
    }>();
  const { user } = useAuth();
  const flatListRef = useRef<FlatList>(null);
  const insets = useSafeAreaInsets();

  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [userName, setUserName] = useState("");
  const [memberCount, setMemberCount] = useState(0);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const chatDocId = userType === "artist" ? `artists_${communityId}` : `enthusiasts_${communityId}`;
  const accentColor = communityColor || "#8B1A1A";

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

  // ── Load user name & member count ──
  useEffect(() => {
    if (!user) return;
    getDoc(doc(db, "users", user.uid)).then((snap) => {
      if (snap.exists()) {
        setUserName(snap.data().name || snap.data().email?.split("@")[0] || "User");
      }
    });
    getDoc(doc(db, "groupChats", chatDocId)).then((snap) => {
      if (snap.exists()) setMemberCount((snap.data().members || []).length);
    });
  }, [user]);

  // ── Subscribe to messages ──
  useEffect(() => {
    if (!user || !chatDocId) return;
    setLoading(true);
    const unsub = onSnapshot(
      query(
        collection(db, "groupChats", chatDocId, "messages"),
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
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 100);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, [user, chatDocId]);

  // ── Send message ──
  const sendMessage = async () => {
    if (!messageText.trim() || !user) return;
    setSending(true);
    const trimmed = messageText.trim();
    setMessageText("");
    try {
      await addDoc(collection(db, "groupChats", chatDocId, "messages"), {
        text: trimmed,
        senderId: user.uid,
        senderName: userName || "User",
        timestamp: serverTimestamp(),
      });
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    } catch {}
    finally { setSending(false); }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMe = item.senderId === user?.uid;
    return (
      <View style={[styles.msgRow, isMe && styles.msgRowMe]}>
        {!isMe && <Text style={styles.senderName}>{item.senderName}</Text>}
        <View style={[
          styles.bubble,
          isMe && [styles.bubbleMe, { backgroundColor: accentColor }],
        ]}>
          <Text style={[styles.bubbleText, isMe && styles.bubbleTextMe]}>{item.text}</Text>
        </View>
        <Text style={[styles.timestamp, isMe && styles.timestampMe]}>
          {item.timestamp.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
        </Text>
      </View>
    );
  };

  const bottomOffset = keyboardHeight > 0 ? keyboardHeight : 0;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color="#2A1005" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={[styles.headerIconWrap, { backgroundColor: accentColor }]}>
            <Ionicons name={(communityIcon as any) || "people"} size={16} color="#fff" />
          </View>
          <View>
            <Text style={styles.headerTitle}>{communityName || "Community"}</Text>
            <Text style={styles.headerSub}>{memberCount} members</Text>
          </View>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {/* Messages or loading */}
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#8B1A1A" />
        </View>
      ) : (
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
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <View style={[styles.emptyIconWrap, { backgroundColor: accentColor + "18" }]}>
                <Ionicons name="chatbubbles-outline" size={30} color={accentColor} />
              </View>
              <Text style={styles.emptyTitle}>No messages yet</Text>
              <Text style={styles.emptySub}>Start the conversation!</Text>
            </View>
          }
        />
      )}

      {/* Input bar */}
      <View style={[styles.inputBar, { bottom: bottomOffset }]}>
        <TextInput
          style={styles.input}
          value={messageText}
          onChangeText={setMessageText}
          placeholder="Type a message…"
          placeholderTextColor="#B8A99A"
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[
            styles.sendBtn,
            { backgroundColor: accentColor },
            (!messageText.trim() || sending) && styles.sendBtnDisabled,
          ]}
          onPress={sendMessage}
          disabled={!messageText.trim() || sending}
        >
          {sending
            ? <ActivityIndicator size="small" color="#fff" />
            : <Ionicons name="send" size={16} color="#fff" />
          }
        </TouchableOpacity>
      </View>
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
    justifyContent: "space-between",
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
  headerCenter: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  headerIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#2A1005",
  },
  headerSub: {
    fontSize: 11,
    color: "#9B8265",
  },
  headerSpacer: {
    width: 36,
  },

  // Messages
  msgList: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  msgRow: {
    marginBottom: 12,
    alignItems: "flex-start",
  },
  msgRowMe: {
    alignItems: "flex-end",
  },
  senderName: {
    fontSize: 11,
    fontWeight: "600",
    color: "#9B8265",
    marginBottom: 3,
    marginLeft: 4,
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
  timestamp: {
    fontSize: 10,
    color: "#9B8265",
    marginTop: 3,
    marginLeft: 4,
  },
  timestampMe: {
    marginRight: 4,
    marginLeft: 0,
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
    justifyContent: "center",
    alignItems: "center",
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
});
