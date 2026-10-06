import { Ionicons } from "@expo/vector-icons";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { db } from "../../lib/firebase";
import COLORS from "../../constants/Colors";
import { useAuth } from "../../contexts/AuthContext";
import { formatCommentTime } from "../../lib/helpers";
import type {
  Comment,
  Listing,
} from "../../lib/types";

interface ArtworkCommentsProps {
  listing: Listing;
  isGuestMode: boolean;
}

export default function ArtworkComments({
  listing,
  isGuestMode,
}: ArtworkCommentsProps) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loadingComments, setLoadingComments] =
    useState(false);
  const [submittingComment, setSubmittingComment] =
    useState(false);

  useEffect(() => {
    setLoadingComments(true);
    const commentsQuery = query(
      collection(
        db,
        "artworkComments",
        listing.id,
        "comments"
      ),
      orderBy("createdAt", "desc")
    );
    const unsubscribe = onSnapshot(
      commentsQuery,
      (snapshot) => {
        setComments(
          snapshot.docs.map((d) => ({
            id: d.id,
            userId: d.data().userId,
            userName: d.data().userName,
            text: d.data().text,
            createdAt: d.data().createdAt,
          })) as Comment[]
        );
        setLoadingComments(false);
      }
    );
    return () => unsubscribe();
  }, [listing.id]);

  const handleSubmitComment = async () => {
    if (!newComment.trim() || !user) return;
    if (isGuestMode) {
      Alert.alert(
        "Sign In Required",
        "Please sign in to comment on artworks",
        [{ text: "OK", style: "cancel" }]
      );
      return;
    }
    try {
      setSubmittingComment(true);
      const userDoc = await getDoc(
        doc(db, "users", user.uid)
      );
      const userData = userDoc.data();
      const displayName =
        userData?.displayName ||
        userData?.name ||
        user.email?.split("@")[0] ||
        "Anonymous";
      await addDoc(
        collection(
          db,
          "artworkComments",
          listing.id,
          "comments"
        ),
        {
          userId: user.uid,
          userName: displayName,
          text: newComment.trim(),
          createdAt: serverTimestamp(),
        }
      );
      setNewComment("");
    } catch (e) {
      console.error("Failed to post comment:", e);
      Alert.alert(
        "Error",
        "Failed to post comment. Please try again."
      );
    } finally {
      setSubmittingComment(false);
    }
  };

  return (
    <View style={styles.commentsSection}>
      <View style={styles.commentsSectionHeader}>
        <Ionicons
          name="chatbubbles-outline"
          size={18}
          color={COLORS.primary.deepRed}
        />
        <Text style={styles.commentsTitle}>
          Comments ({comments.length})
        </Text>
      </View>

      <View style={styles.divider} />

      {/* Comment input */}
      <View style={styles.commentInputRow}>
        <TextInput
          style={styles.commentInput}
          placeholder={
            isGuestMode
              ? "Sign in to comment…"
              : "Add a comment…"
          }
          value={newComment}
          onChangeText={setNewComment}
          multiline
          maxLength={500}
          editable={!isGuestMode && !submittingComment}
        />
        <TouchableOpacity
          style={[
            styles.commentSendBtn,
            (!newComment.trim() ||
              submittingComment ||
              isGuestMode) &&
              styles.commentSendBtnDisabled,
          ]}
          onPress={handleSubmitComment}
          disabled={
            !newComment.trim() ||
            submittingComment ||
            isGuestMode
          }
        >
          {submittingComment ? (
            <ActivityIndicator
              size="small"
              color={COLORS.text.white}
            />
          ) : (
            <Ionicons
              name="send"
              size={18}
              color={COLORS.text.white}
            />
          )}
        </TouchableOpacity>
      </View>

      {/* Comments list */}
      {loadingComments ? (
        <View style={styles.commentsLoading}>
          <ActivityIndicator
            size="small"
            color={COLORS.primary.deepRed}
          />
          <Text style={styles.loadingText}>
            Loading comments…
          </Text>
        </View>
      ) : comments.length === 0 ? (
        <View style={styles.emptyComments}>
          <Ionicons
            name="chatbubble-outline"
            size={40}
            color="#ddd"
          />
          <Text style={styles.emptyCommentsTitle}>
            No comments yet
          </Text>
          <Text style={styles.emptyCommentsSub}>
            Be the first to share your thoughts!
          </Text>
        </View>
      ) : (
        <View style={styles.commentsList}>
          {comments.map((comment) => (
            <View
              key={comment.id}
              style={styles.commentItem}
            >
              <View style={styles.commentAvatar}>
                <Text style={styles.commentAvatarText}>
                  {comment.userName
                    .charAt(0)
                    .toUpperCase()}
                </Text>
              </View>
              <View style={styles.commentBubble}>
                <View
                  style={styles.commentBubbleHeader}
                >
                  <Text style={styles.commentUserName}>
                    {comment.userName}
                  </Text>
                  <Text style={styles.commentTime}>
                    {formatCommentTime(
                      comment.createdAt
                    )}
                  </Text>
                </View>
                <Text style={styles.commentText}>
                  {comment.text}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  commentsSection: {
    marginTop: 24,
  },
  commentsSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  commentsTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: COLORS.text.primary,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border.light,
    marginVertical: 20,
  },
  commentInputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    marginBottom: 20,
  },
  commentInput: {
    flex: 1,
    backgroundColor: COLORS.background.secondary,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    maxHeight: 100,
    color: COLORS.text.primary,
    borderWidth: 1,
    borderColor: COLORS.border.light,
  },
  commentSendBtn: {
    backgroundColor: COLORS.primary.forestGreen,
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: "center",
    alignItems: "center",
  },
  commentSendBtnDisabled: {
    backgroundColor: COLORS.button.disabled,
  },
  commentsLoading: {
    padding: 32,
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: COLORS.text.secondary,
  },
  emptyComments: {
    padding: 32,
    alignItems: "center",
    gap: 8,
  },
  emptyCommentsTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text.secondary,
    marginTop: 8,
  },
  emptyCommentsSub: {
    fontSize: 13,
    color: COLORS.text.muted,
  },
  commentsList: {
    gap: 14,
  },
  commentItem: {
    flexDirection: "row",
    gap: 10,
  },
  commentAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.primary.deepRed,
    justifyContent: "center",
    alignItems: "center",
  },
  commentAvatarText: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.text.white,
  },
  commentBubble: {
    flex: 1,
    backgroundColor: COLORS.background.secondary,
    borderRadius: 12,
    padding: 12,
  },
  commentBubbleHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  commentUserName: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.text.primary,
  },
  commentTime: {
    fontSize: 11,
    color: COLORS.text.muted,
  },
  commentText: {
    fontSize: 13,
    color: COLORS.text.secondary,
    lineHeight: 19,
  },
});
