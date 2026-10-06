import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { db } from "../../../lib/firebase";
import { useAuth } from "../../../contexts/AuthContext";

interface ChatPreview {
  id: string;
  participantId: string;
  participantName: string;
  participantEmail: string;
  lastMessage: string;
  lastMessageTime: Date;
  unread: boolean;
  listingId?: string;
  listingTitle?: string;
  listingImage?: string;
  listingPrice?: number;
  portfolioId?: string;
  portfolioTitle?: string;
  portfolioImage?: string;
}

const TABS = [
  { key: 'marketplace', label: 'Marketplace', icon: 'tag' },
  { key: 'chat',        label: 'Direct',      icon: 'message-circle' },
  { key: 'community',   label: 'Community',   icon: 'users' },
] as const;

export default function Chat() {
  const router = useRouter();
  const { user, userProfile } = useAuth();

  const [activeTab, setActiveTab] = useState<'marketplace' | 'chat' | 'community'>('marketplace');
  const [searchQuery, setSearchQuery] = useState('');
  const [conversations, setConversations] = useState<ChatPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [isNavigating, setIsNavigating] = useState(false);

  // ── Navigation helper ──
  const handleNavigation = (pathname: string, params?: any) => {
    if (isNavigating) return;
    setIsNavigating(true);
    if (params) router.push({ pathname, params } as any);
    else router.push(pathname as any);
    setTimeout(() => setIsNavigating(false), 1500);
  };

  // ── Fetch chats ──
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', user.uid),
      orderBy('lastMessageTime', 'desc'),
    );

    const unsub = onSnapshot(
      q,
      async (snapshot) => {
        try {
          const data = await Promise.all(
            snapshot.docs.map(async (chatDoc) => {
              const d = chatDoc.data();
              const otherUserId = d.participants.find((id: string) => id !== user.uid);
              return {
                id: chatDoc.id,
                participantId: otherUserId,
                participantName: otherUserId
                  ? (d.participantNames?.[otherUserId] || 'User')
                  : 'User',
                participantEmail: otherUserId
                  ? (d.participantEmails?.[otherUserId] || '')
                  : '',
                lastMessage: d.lastMessage || 'No messages yet',
                lastMessageTime: d.lastMessageTime?.toDate() || new Date(),
                unread: d[`unread_${user.uid}`] || false,
                listingId: d.listingId,
                listingTitle: d.listingTitle,
                listingImage: d.listingImage || d.listingImageUrl,
                listingPrice: d.listingPrice,
                portfolioId: d.portfolioId,
                portfolioTitle: d.portfolioTitle,
                portfolioImage: d.portfolioImage,
              };
            }),
          );
          setConversations(data);
          setLoading(false);
        } catch {
          setLoading(false);
        }
      },
      () => setLoading(false),
    );

    return () => unsub();
  }, [user]);

  // ── Community tab ──
  useEffect(() => {
    if (activeTab !== 'community') return;
    if (!userProfile?.role) return;

    if (userProfile.role === 'enthusiast') {
      handleNavigation('/(app)/chat/group-enthusiast');
    } else if (userProfile.role === 'artist') {
      handleNavigation('/(app)/chat/group-artist');
    }

    setTimeout(() => setActiveTab('marketplace'), 100);
  }, [activeTab]);

  // ── Delete chat ──
  const handleDeleteChat = (chatId: string) => {
    Alert.alert(
      'Delete Chat',
      'Are you sure you want to delete this conversation?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'chats', chatId));
            } catch {
              Alert.alert('Error', 'Failed to delete the chat.');
            }
          },
        },
      ],
    );
  };

  // ── Filter conversations ──
  const filteredConversations = conversations.filter((chat) => {
    const isMarket = !!chat.listingId;
    if (activeTab === 'marketplace' && !isMarket) return false;
    if (activeTab === 'chat' && isMarket) return false;

    const q = searchQuery.toLowerCase();
    return (
      chat.participantName.toLowerCase().includes(q) ||
      chat.listingTitle?.toLowerCase().includes(q) ||
      chat.portfolioTitle?.toLowerCase().includes(q)
    );
  });

  // ── Format timestamp ──
  const formatTime = (date: Date): string => {
    const diff = Date.now() - date.getTime();
    const hours = Math.floor(diff / 3600000);

    if (hours < 1) return `${Math.floor(diff / 60000)}m`;
    if (hours < 24) return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

    const days = Math.floor(hours / 24);
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // ── Render chat item ──
  const renderItem = ({ item }: { item: ChatPreview }) => (
    <TouchableOpacity
      style={styles.chatItem}
      onPress={() =>
        handleNavigation('/(app)/chat/detail', {
          id: item.id,
          participantName: item.participantName,
          listingTitle: item.listingTitle || '',
          listingId: item.listingId || '',
        })
      }
      onLongPress={() => handleDeleteChat(item.id)}
      disabled={isNavigating}
      delayLongPress={500}
      activeOpacity={0.75}
    >
      {/* Avatar */}
      <View style={styles.avatarWrap}>
        {item.listingImage || item.portfolioImage ? (
          <Image
            source={{ uri: item.listingImage || item.portfolioImage }}
            style={styles.listingImg}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.avatarText}>
              {item.participantName.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        {item.unread && <View style={styles.unreadBadge} />}
      </View>

      {/* Content */}
      <View style={styles.chatContent}>
        <View style={styles.topRow}>
          <View style={styles.nameCol}>
            <Text
              style={[styles.participantName, item.unread && styles.participantNameUnread]}
              numberOfLines={1}
            >
              {item.participantName}
            </Text>
            {(item.listingTitle || item.portfolioTitle) && (
              <View style={styles.itemRow}>
                <Feather
                  name={item.listingTitle ? 'tag' : 'image'}
                  size={11}
                  color="#8B1A1A"
                />
                <Text style={styles.itemName} numberOfLines={1}>
                  {item.listingTitle || item.portfolioTitle}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.timeCol}>
            <Text style={styles.timestamp}>{formatTime(item.lastMessageTime)}</Text>
            {item.listingPrice && (
              <View style={styles.pricePill}>
                <Text style={styles.priceText}>
                  ₱{item.listingPrice.toLocaleString()}
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.messageRow}>
          <Text
            style={[styles.lastMsg, item.unread && styles.lastMsgUnread]}
            numberOfLines={1}
          >
            {item.lastMessage}
          </Text>
          {item.unread && <View style={styles.unreadDot} />}
        </View>
      </View>
    </TouchableOpacity>
  );

  // ── Loading state ──
  if (loading) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#8B1A1A" />
          <Text style={styles.loadingText}>Loading chats…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAF7F2" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {TABS.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => setActiveTab(tab.key as any)}
              activeOpacity={0.75}
            >
              <Feather
                name={tab.icon as any}
                size={14}
                color={active ? '#8B1A1A' : '#9B8265'}
              />
              <Text style={[styles.tabText, active && styles.tabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <View style={styles.searchBar}>
          <Feather name="search" size={16} color="#9B8265" />
          <TextInput
            style={styles.searchInput}
            placeholder={activeTab === 'marketplace' ? 'Search items…' : 'Search people…'}
            placeholderTextColor="#C4AFA5"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Feather name="x-circle" size={16} color="#C4AFA5" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Conversation list */}
      {filteredConversations.length > 0 ? (
        <FlatList
          data={filteredConversations}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <View style={styles.emptyWrap}>
          <View style={styles.emptyIconCircle}>
            <Feather
              name={activeTab === 'marketplace' ? 'shopping-bag' : 'message-circle'}
              size={36}
              color="#C8BAA8"
            />
          </View>
          <Text style={styles.emptyTitle}>
            {searchQuery
              ? 'No results found'
              : activeTab === 'marketplace'
              ? 'No marketplace chats'
              : 'No direct chats'}
          </Text>
          <Text style={styles.emptySub}>
            {searchQuery
              ? 'Try searching for something else'
              : activeTab === 'marketplace'
              ? 'Inquiries about items will appear here'
              : 'Direct messages will appear here'}
          </Text>
        </View>
      )}
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
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#9B8265',
  },

  // Header
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#2A1005',
    letterSpacing: -0.5,
  },

  // Tabs
  tabRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#EDE0D4',
  },
  tabActive: {
    backgroundColor: '#FDF5F2',
    borderColor: '#8B1A1A',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9B8265',
  },
  tabTextActive: {
    color: '#8B1A1A',
    fontWeight: '700',
  },

  // Search
  searchWrap: {
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#EDE0D4',
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#2A1005',
    paddingVertical: 0,
  },

  // List
  list: {
    paddingBottom: 16,
  },

  // Chat item
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0E8E0',
    backgroundColor: '#fff',
    gap: 14,
  },
  avatarWrap: {
    position: 'relative',
    flexShrink: 0,
  },
  listingImg: {
    width: 56,
    height: 56,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EDE0D4',
  },
  avatarFallback: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FDF5F2',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EDE0D4',
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#8B1A1A',
  },
  unreadBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#8B1A1A',
    borderWidth: 2,
    borderColor: '#FAF7F2',
  },
  chatContent: {
    flex: 1,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 5,
  },
  nameCol: {
    flex: 1,
    marginRight: 8,
  },
  participantName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2A1005',
    marginBottom: 3,
  },
  participantNameUnread: {
    fontWeight: '800',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  itemName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8B1A1A',
    flex: 1,
  },
  timeCol: {
    alignItems: 'flex-end',
    gap: 4,
  },
  timestamp: {
    fontSize: 11,
    color: '#B8A99A',
    fontWeight: '500',
  },
  pricePill: {
    backgroundColor: '#FDF5F2',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F0DDD8',
  },
  priceText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8B1A1A',
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  lastMsg: {
    flex: 1,
    fontSize: 13,
    color: '#9B8265',
    lineHeight: 18,
  },
  lastMsgUnread: {
    fontWeight: '600',
    color: '#2A1005',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#8B1A1A',
    flexShrink: 0,
  },

  // Empty
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#F5F1E8',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#2A1005',
  },
  emptySub: {
    fontSize: 13,
    color: '#9B8265',
    textAlign: 'center',
    lineHeight: 20,
  },
});
