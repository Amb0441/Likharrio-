import { Ionicons } from "@expo/vector-icons";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import COLORS from "../../constants/Colors";
import { db } from "../../lib/firebase";
import { notifyComment } from "../../utils/notifications";

interface Comment {
  id: string;
  userId: string;
  userName: string;
  text: string;
  createdAt: any;
  parentId?: string | null;
}

interface CommentSectionProps {
  portfolioId: string;
  portfolioOwnerId?: string;
  portfolioTitle?: string;
  portfolioCoverImage?: string;
  currentUserId: string | undefined;
  isGuestMode: boolean;
  onSignInRequired: () => void;
}

export default function CommentSection({
  portfolioId,
  portfolioOwnerId,
  portfolioTitle,
  portfolioCoverImage,
  currentUserId,
  isGuestMode,
  onSignInRequired,
}: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [expandedAnimation] = useState(new Animated.Value(0));

  const INITIAL_COMMENT_COUNT = 4;

  useEffect(() => {
    fetchComments();
  }, [portfolioId]);

  useEffect(() => {
    Animated.timing(expandedAnimation, {
      toValue: showAll ? 1 : 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [showAll]);

  const fetchComments = async () => {
    try {
      setLoading(true);
      const commentsQuery = query(
        collection(db, "comments"),
        where("portfolioId", "==", portfolioId),
        orderBy("createdAt", "desc")
      );

      const snapshot = await getDocs(commentsQuery);
      const commentsData: Comment[] = [];

      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        commentsData.push({
          id: docSnap.id,
          userId: data.userId,
          userName: data.userName,
          text: data.text,
          createdAt: data.createdAt,
          parentId: data.parentId || null,
        });
      }

      setComments(commentsData);
    } catch (error) {
      console.error("Error fetching comments:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!currentUserId || isGuestMode) {
      onSignInRequired();
      return;
    }

    if (!newComment.trim()) {
      Alert.alert("Empty Comment", "Please enter a comment before submitting.");
      return;
    }

    try {
      setSubmitting(true);

      const userDoc = await getDoc(doc(db, "users", currentUserId));
      const userData = userDoc.data();
      const userName = userData?.name || userData?.displayName || userData?.email?.split("@")[0] || "Anonymous";

      await addDoc(collection(db, "comments"), {
        portfolioId,
        userId: currentUserId,
        userName,
        text: newComment.trim(),
        createdAt: serverTimestamp(),
        parentId: null,
      });

      // Notify the portfolio owner (don't notify yourself)
      if (portfolioOwnerId && portfolioOwnerId !== currentUserId) {
        try {
          await notifyComment(
            portfolioOwnerId,
            userName,
            currentUserId,
            portfolioTitle || 'your showcase',
            portfolioId,
            'portfolio',
            newComment.trim().length > 60
              ? newComment.trim().slice(0, 60) + '...'
              : newComment.trim(),
            portfolioCoverImage
          );
        } catch (notifyErr) {
          console.warn('⚠️ Failed to send comment notification:', notifyErr);
        }
      }

      setNewComment("");
      await fetchComments();
    } catch (error) {
      console.error("Error adding comment:", error);
      Alert.alert("Error", "Failed to add comment. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddReply = async (parentId: string) => {
    if (!currentUserId || isGuestMode) {
      onSignInRequired();
      return;
    }

    if (!replyText.trim()) {
      Alert.alert("Empty Reply", "Please enter a reply before submitting.");
      return;
    }

    try {
      setSubmitting(true);

      const userDoc = await getDoc(doc(db, "users", currentUserId));
      const userData = userDoc.data();
      const userName = userData?.name || userData?.displayName || userData?.email?.split("@")[0] || "Anonymous";

      await addDoc(collection(db, "comments"), {
        portfolioId,
        userId: currentUserId,
        userName,
        text: replyText.trim(),
        createdAt: serverTimestamp(),
        parentId: parentId,
      });

      // Notify portfolio owner about the reply (don't notify yourself)
      if (portfolioOwnerId && portfolioOwnerId !== currentUserId) {
        try {
          await notifyComment(
            portfolioOwnerId,
            userName,
            currentUserId,
            portfolioTitle || 'your showcase',
            portfolioId,
            'portfolio',
            replyText.trim().length > 60
              ? replyText.trim().slice(0, 60) + '...'
              : replyText.trim(),
            portfolioCoverImage
          );
        } catch (notifyErr) {
          console.warn('⚠️ Failed to send reply notification:', notifyErr);
        }
      }

      setReplyText("");
      setReplyingTo(null);
      await fetchComments();
    } catch (error) {
      console.error("Error adding reply:", error);
      Alert.alert("Error", "Failed to add reply. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string, commentUserId: string) => {
    if (currentUserId !== commentUserId) {
      Alert.alert("Error", "You can only delete your own comments.");
      return;
    }

    Alert.alert(
      "Delete Comment",
      "Are you sure you want to delete this comment?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteDoc(doc(db, "comments", commentId));
              
              // Delete all replies to this comment
              const repliesQuery = query(
                collection(db, "comments"),
                where("parentId", "==", commentId)
              );
              const repliesSnapshot = await getDocs(repliesQuery);
              const deletePromises = repliesSnapshot.docs.map(doc => deleteDoc(doc.ref));
              await Promise.all(deletePromises);
              
              await fetchComments();
            } catch (error) {
              console.error("Error deleting comment:", error);
              Alert.alert("Error", "Failed to delete comment.");
            }
          },
        },
      ]
    );
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  };

  const renderComment = (item: Comment, isReply: boolean = false) => {
    const replies = comments.filter(c => c.parentId === item.id);
    const isReplyingToThis = replyingTo === item.id;

    return (
      <View key={item.id} style={[styles.commentCard, isReply && styles.replyCard]}>
        <View style={styles.commentHeader}>
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarText}>
              {item.userName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.commentInfo}>
            <Text style={styles.commentUserName}>{item.userName}</Text>
            <Text style={styles.commentDate}>{formatDate(item.createdAt)}</Text>
          </View>
          {currentUserId === item.userId && (
            <TouchableOpacity
              onPress={() => handleDeleteComment(item.id, item.userId)}
              style={styles.deleteButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="trash-outline" size={18} color="#999" />
            </TouchableOpacity>
          )}
        </View>
        
        <Text style={styles.commentText}>{item.text}</Text>

        {/* Reply Button - Only show for parent comments */}
        {!isReply && (
          <TouchableOpacity
            style={styles.replyButton}
            onPress={() => {
              if (!currentUserId || isGuestMode) {
                onSignInRequired();
                return;
              }
              setReplyingTo(isReplyingToThis ? null : item.id);
              setReplyText("");
            }}
          >
            <Ionicons 
              name={isReplyingToThis ? "close" : "chatbubble-outline"} 
              size={14} 
              color={COLORS.primary.forestGreen} 
            />
            <Text style={styles.replyButtonText}>
              {isReplyingToThis ? "Cancel" : "Reply"}
            </Text>
            {replies.length > 0 && !isReplyingToThis && (
              <Text style={styles.replyCount}>({replies.length})</Text>
            )}
          </TouchableOpacity>
        )}

        {/* Reply Input */}
        {isReplyingToThis && (
          <View style={styles.replyInputContainer}>
            <TextInput
              style={styles.replyInput}
              placeholder={`Reply to ${item.userName}...`}
              placeholderTextColor="#999"
              value={replyText}
              onChangeText={setReplyText}
              multiline
              maxLength={500}
              autoFocus
            />
            <TouchableOpacity
              style={[
                styles.replySubmitButton,
                (!replyText.trim() || submitting) && styles.submitButtonDisabled,
              ]}
              onPress={() => handleAddReply(item.id)}
              disabled={!replyText.trim() || submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="send" size={16} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Render Replies */}
        {replies.length > 0 && (
          <View style={styles.repliesContainer}>
            {replies.map(reply => renderComment(reply, true))}
          </View>
        )}
      </View>
    );
  };

  // Filter to show only parent comments (no replies at top level)
  const parentComments = comments.filter(c => !c.parentId);
  const displayedComments = showAll ? parentComments : parentComments.slice(0, INITIAL_COMMENT_COUNT);
  const hasMoreComments = parentComments.length > INITIAL_COMMENT_COUNT;

  return (
    <View style={styles.container}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          Comments {parentComments.length > 0 && `(${parentComments.length})`}
        </Text>
      </View>

      {/* Comment Input */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Add a comment..."
          placeholderTextColor="#999"
          value={newComment}
          onChangeText={setNewComment}
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[
            styles.submitButton,
            (!newComment.trim() || submitting) && styles.submitButtonDisabled,
          ]}
          onPress={handleAddComment}
          disabled={!newComment.trim() || submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="send" size={20} color="#fff" />
          )}
        </TouchableOpacity>
      </View>

      {/* Comments List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={COLORS.primary.deepRed} />
        </View>
      ) : parentComments.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="chatbubbles-outline" size={48} color="#ccc" />
          <Text style={styles.emptyText}>No comments yet</Text>
          <Text style={styles.emptySubtext}>Be the first to comment!</Text>
        </View>
      ) : (
        <>
          <View style={styles.commentsList}>
            {displayedComments.map(comment => renderComment(comment))}
          </View>

          {/* Show More/Less Button */}
          {hasMoreComments && (
            <TouchableOpacity
              style={styles.showMoreButton}
              onPress={() => setShowAll(!showAll)}
              activeOpacity={0.7}
            >
              <Text style={styles.showMoreText}>
                {showAll 
                  ? "Show Less" 
                  : `Show ${parentComments.length - INITIAL_COMMENT_COUNT} More ${parentComments.length - INITIAL_COMMENT_COUNT === 1 ? 'Comment' : 'Comments'}`
                }
              </Text>
              <Ionicons 
                name={showAll ? "chevron-up" : "chevron-down"} 
                size={18} 
                color={COLORS.primary.forestGreen} 
              />
            </TouchableOpacity>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 32,
    marginBottom: 24,
  },
  sectionHeader: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.text.primary,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 12,
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  input: {
    flex: 1,
    backgroundColor: "#F8F8F8",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.text.primary,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: "#ECECEC",
  },
  submitButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary.forestGreen,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  submitButtonDisabled: {
    backgroundColor: "#ccc",
    shadowOpacity: 0,
    elevation: 0,
  },
  loadingContainer: {
    paddingVertical: 32,
    alignItems: "center",
  },
  emptyContainer: {
    paddingVertical: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#999",
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#bbb",
    marginTop: 4,
  },
  commentsList: {
    gap: 16,
  },
  commentCard: {
    backgroundColor: "#FAFAFA",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
  replyCard: {
    backgroundColor: "#F5F5F5",
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary.forestGreen,
    marginTop: 12,
  },
  commentHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 12,
  },
  avatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary.deepRed,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  commentInfo: {
    flex: 1,
  },
  commentUserName: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text.primary,
    marginBottom: 2,
  },
  commentDate: {
    fontSize: 12,
    color: "#999",
  },
  deleteButton: {
    padding: 4,
  },
  commentText: {
    fontSize: 15,
    color: COLORS.text.secondary,
    lineHeight: 22,
  },
  replyButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#ECECEC",
  },
  replyButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.primary.forestGreen,
  },
  replyCount: {
    fontSize: 12,
    color: "#999",
    marginLeft: 2,
  },
  replyInputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#ECECEC",
  },
  replyInput: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.text.primary,
    maxHeight: 80,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  replySubmitButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary.forestGreen,
    justifyContent: "center",
    alignItems: "center",
  },
  repliesContainer: {
    marginTop: 12,
    marginLeft: 16,
    gap: 12,
  },
  showMoreButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    marginTop: 12,
    backgroundColor: "#F8F8F8",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ECECEC",
  },
  showMoreText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.primary.forestGreen,
  },
});
