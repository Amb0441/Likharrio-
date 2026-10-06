import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { sendPushNotification } from './pushNotifications';

interface CreateNotificationParams {
  userId: string;
  type: 'follow' | 'like' | 'comment' | 'message' | 'sale' | 'event' | 'listing' | 'portfolio' | 'system';
  title: string;
  body: string;
  fromUserId?: string;
  fromUserName?: string;
  fromUserAvatar?: string;
  targetId?: string;
  targetType?: string;
  imageUrl?: string;
}

export const createNotification = async (params: CreateNotificationParams) => {
  try {
    // 1. Save to Firestore (in-app notifications)
    await addDoc(collection(db, 'notifications'), {
      userId: params.userId,
      type: params.type,
      title: params.title,
      body: params.body,
      read: false,
      createdAt: serverTimestamp(),
      fromUserId: params.fromUserId || null,
      fromUserName: params.fromUserName || null,
      fromUserAvatar: params.fromUserAvatar || null,
      targetId: params.targetId || null,
      targetType: params.targetType || null,
      imageUrl: params.imageUrl || null,
    });

    // 2. Send push notification (real-time device notification)
    await sendPushNotification(
      params.userId,
      params.title,
      params.body,
      {
        type: params.type,
        targetId: params.targetId,
        targetType: params.targetType,
        fromUserId: params.fromUserId,
      }
    );

    console.log('✅ Notification created and push sent');
  } catch (error) {
    console.error('❌ Error creating notification:', error);
  }
};

// ─────────────────────────────────────────────
// FOLLOW
// ─────────────────────────────────────────────
export const notifyNewFollower = async (
  artistId: string,
  followerName: string,
  followerId: string
) => {
  await createNotification({
    userId: artistId,
    type: 'follow',
    title: 'New Follower 🎉',
    body: `${followerName} started following you`,
    fromUserId: followerId,
    fromUserName: followerName,
  });
};

// ─────────────────────────────────────────────
// MESSAGE
// ─────────────────────────────────────────────
export const notifyNewMessage = async (
  recipientId: string,
  senderName: string,
  senderId: string,
  chatId: string,
  messagePreview: string
) => {
  await createNotification({
    userId: recipientId,
    type: 'message',
    title: `💬 ${senderName}`,
    body: messagePreview,
    fromUserId: senderId,
    fromUserName: senderName,
    targetId: chatId,
  });
};

// ─────────────────────────────────────────────
// SALE
// ─────────────────────────────────────────────
export const notifyNewSale = async (
  artistId: string,
  listingTitle: string,
  listingId: string,
  buyerName: string,
  imageUrl?: string
) => {
  await createNotification({
    userId: artistId,
    type: 'sale',
    title: '💰 New Sale!',
    body: `${buyerName} marked "${listingTitle}" as sold`,
    targetId: listingId,
    targetType: 'listing',
    imageUrl,
  });
};

// ─────────────────────────────────────────────
// NEW LISTING (notify followers)
// ─────────────────────────────────────────────
export const notifyNewListing = async (
  followerId: string,
  artistName: string,
  artistId: string,
  listingTitle: string,
  listingId: string,
  imageUrl?: string
) => {
  await createNotification({
    userId: followerId,
    type: 'listing',
    title: '🎨 New Artwork Available',
    body: `${artistName} posted "${listingTitle}"`,
    fromUserId: artistId,
    fromUserName: artistName,
    targetId: listingId,
    targetType: 'listing',
    imageUrl,
  });
};

// ─────────────────────────────────────────────
// NEW PORTFOLIO (notify followers)
// ─────────────────────────────────────────────
export const notifyNewPortfolio = async (
  followerId: string,
  artistName: string,
  artistId: string,
  portfolioTitle: string,
  portfolioId: string,
  imageUrl?: string
) => {
  await createNotification({
    userId: followerId,
    type: 'portfolio',
    title: '🖼️ New Showcase',
    body: `${artistName} added "${portfolioTitle}" to their portfolio`,
    fromUserId: artistId,
    fromUserName: artistName,
    targetId: portfolioId,
    targetType: 'portfolio',
    imageUrl,
  });
};

// ─────────────────────────────────────────────
// NEW EVENT (notify followers)
// ─────────────────────────────────────────────
export const notifyNewEvent = async (
  followerId: string,
  artistName: string,
  artistId: string,
  eventTitle: string,
  eventId: string
) => {
  await createNotification({
    userId: followerId,
    type: 'event',
    title: '📅 New Event',
    body: `${artistName} created an event: "${eventTitle}"`,
    fromUserId: artistId,
    fromUserName: artistName,
    targetId: eventId,
    targetType: 'event',
  });
};

// ─────────────────────────────────────────────
// LIKE
// ─────────────────────────────────────────────
export const notifyLike = async (
  ownerId: string,
  likerName: string,
  likerId: string,
  targetTitle: string,
  targetId: string,
  targetType: 'portfolio' | 'listing',
  imageUrl?: string
) => {
  await createNotification({
    userId: ownerId,
    type: 'like',
    title: '❤️ New Like',
    body: `${likerName} liked your ${targetType === 'portfolio' ? 'showcase' : 'listing'}: "${targetTitle}"`,
    fromUserId: likerId,
    fromUserName: likerName,
    targetId,
    targetType,
    imageUrl,
  });
};

// ─────────────────────────────────────────────
// COMMENT
// ─────────────────────────────────────────────
export const notifyComment = async (
  ownerId: string,
  commenterName: string,
  commenterId: string,
  targetTitle: string,
  targetId: string,
  targetType: 'portfolio' | 'listing',
  commentPreview: string,
  imageUrl?: string
) => {
  await createNotification({
    userId: ownerId,
    type: 'comment',
    title: '💬 New Comment',
    body: `${commenterName} commented on "${targetTitle}": ${commentPreview}`,
    fromUserId: commenterId,
    fromUserName: commenterName,
    targetId,
    targetType,
    imageUrl,
  });
};
