/**
 * User Activity Service
 * Handles likes, views, shares, and saves for enthusiasts
 *
 * OPTIMIZED for Firebase Spark plan (150 users):
 * - Stats are read from cached fields on the user doc (1 read) instead of 5 collection scans
 * - recordView uses a deduped doc ID (userId_itemId) — one doc per user-item pair, not one per view
 * - getUserViewHistory uses Firestore orderBy + limit instead of client-side sort/slice
 * - All count helpers now read from the user doc cache first
 */

import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  serverTimestamp,
  increment,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';

// ============================================================
// TYPES
// ============================================================

export interface LikeData {
  userId: string;
  itemId: string;
  itemType: 'portfolio' | 'listing';
  artistId: string;
  createdAt: any;
}

export interface SaveData {
  userId: string;
  itemId: string;
  itemType: 'portfolio' | 'listing';
  artistId: string;
  createdAt: any;
}

export interface ViewData {
  userId: string;
  itemId: string;
  itemType: 'portfolio' | 'listing';
  artistId: string;
  viewCount: number;
  lastViewedAt: any;
}

export interface ShareData {
  userId: string;
  itemId: string;
  itemType: 'portfolio' | 'listing';
  artistId: string;
  sharedAt: any;
  platform?: string;
}

export interface EnthusiastStats {
  likes: number;
  saved: number;
  following: number;
  viewed: number;
  shared: number;
}

// ============================================================
// LIKES
// ============================================================

/**
 * Toggle like on a portfolio or listing.
 * Also increments/decrements likesCount on the user doc (cache).
 */
export async function toggleLike(
  userId: string,
  itemId: string,
  itemType: 'portfolio' | 'listing',
  artistId: string
): Promise<boolean> {
  try {
    const likeId = `${userId}_${itemId}`;
    const likeRef = doc(db, 'user_likes', likeId);
    const likeSnap = await getDoc(likeRef);

    const batch = writeBatch(db);
    const userRef = doc(db, 'users', userId);
    const itemRef = doc(db, itemType === 'portfolio' ? 'portfolios' : 'listings', itemId);

    if (likeSnap.exists()) {
      // Unlike
      batch.delete(likeRef);
      batch.update(itemRef, { likes: increment(-1), likesCount: increment(-1) });
      batch.update(userRef, { likesCount: increment(-1) }); // update cached count
      await batch.commit();
      return false;
    } else {
      // Like
      const likeData: LikeData = { userId, itemId, itemType, artistId, createdAt: serverTimestamp() };
      batch.set(likeRef, likeData);
      batch.update(itemRef, { likes: increment(1), likesCount: increment(1) });
      batch.update(userRef, { likesCount: increment(1) }); // update cached count
      await batch.commit();
      return true;
    }
  } catch (error) {
    console.error('Error toggling like:', error);
    throw error;
  }
}

export async function hasUserLiked(userId: string, itemId: string): Promise<boolean> {
  try {
    const likeSnap = await getDoc(doc(db, 'user_likes', `${userId}_${itemId}`));
    return likeSnap.exists();
  } catch (error) {
    console.error('Error checking like status:', error);
    return false;
  }
}

export async function getUserLikes(userId: string): Promise<LikeData[]> {
  try {
    const snap = await getDocs(query(collection(db, 'user_likes'), where('userId', '==', userId)));
    return snap.docs.map(d => d.data() as LikeData);
  } catch (error) {
    console.error('Error fetching user likes:', error);
    return [];
  }
}

/**
 * Returns cached count from the user doc — 1 read, not a collection scan.
 */
export async function getUserLikesCount(userId: string): Promise<number> {
  try {
    const userSnap = await getDoc(doc(db, 'users', userId));
    return userSnap.exists() ? (userSnap.data().likesCount ?? 0) : 0;
  } catch (error) {
    console.error('Error fetching likes count:', error);
    return 0;
  }
}

// ============================================================
// SAVES / BOOKMARKS
// ============================================================

/**
 * Toggle save/bookmark. Also updates savesCount on the user doc (cache).
 */
export async function toggleSave(
  userId: string,
  itemId: string,
  itemType: 'portfolio' | 'listing',
  artistId: string
): Promise<boolean> {
  try {
    const saveId = `${userId}_${itemId}`;
    const saveRef = doc(db, 'user_saves', saveId);
    const saveSnap = await getDoc(saveRef);

    const batch = writeBatch(db);
    const userRef = doc(db, 'users', userId);
    const itemRef = doc(db, itemType === 'portfolio' ? 'portfolios' : 'listings', itemId);

    if (saveSnap.exists()) {
      batch.delete(saveRef);
      batch.update(itemRef, { saves: increment(-1), savesCount: increment(-1) });
      batch.update(userRef, { savesCount: increment(-1) });
      await batch.commit();
      return false;
    } else {
      const saveData: SaveData = { userId, itemId, itemType, artistId, createdAt: serverTimestamp() };
      batch.set(saveRef, saveData);
      batch.update(itemRef, { saves: increment(1), savesCount: increment(1) });
      batch.update(userRef, { savesCount: increment(1) });
      await batch.commit();
      return true;
    }
  } catch (error) {
    console.error('Error toggling save:', error);
    throw error;
  }
}

export async function hasUserSaved(userId: string, itemId: string): Promise<boolean> {
  try {
    const saveSnap = await getDoc(doc(db, 'user_saves', `${userId}_${itemId}`));
    return saveSnap.exists();
  } catch (error) {
    console.error('Error checking save status:', error);
    return false;
  }
}

export async function getUserSaves(userId: string): Promise<SaveData[]> {
  try {
    const snap = await getDocs(query(collection(db, 'user_saves'), where('userId', '==', userId)));
    return snap.docs.map(d => d.data() as SaveData);
  } catch (error) {
    console.error('Error fetching user saves:', error);
    return [];
  }
}

/**
 * Returns cached count from the user doc — 1 read, not a collection scan.
 */
export async function getUserSavesCount(userId: string): Promise<number> {
  try {
    const userSnap = await getDoc(doc(db, 'users', userId));
    return userSnap.exists() ? (userSnap.data().savesCount ?? 0) : 0;
  } catch (error) {
    console.error('Error fetching saves count:', error);
    return 0;
  }
}

// ============================================================
// VIEWS / HISTORY
// ============================================================

/**
 * Record a view.
 *
 * OPTIMIZED: Uses a stable doc ID (userId_itemId) so repeated views
 * increment a counter instead of creating a new document every time.
 * This prevents view_history from growing unboundedly.
 * Also updates viewedCount on the user doc (cache).
 */
export async function recordView(
  userId: string,
  itemId: string,
  itemType: 'portfolio' | 'listing',
  artistId: string
): Promise<void> {
  try {
    const viewId = `${userId}_${itemId}`; // stable ID — one doc per user-item pair
    const viewRef = doc(db, 'view_history', viewId);
    const viewSnap = await getDoc(viewRef);

    const batch = writeBatch(db);
    const itemRef = doc(db, itemType === 'portfolio' ? 'portfolios' : 'listings', itemId);

    if (viewSnap.exists()) {
      // Already viewed — just update timestamp and bump view count on the item
      batch.update(viewRef, { lastViewedAt: serverTimestamp(), viewCount: increment(1) });
    } else {
      // First view — create the doc and update user cached count
      const viewData: ViewData = {
        userId,
        itemId,
        itemType,
        artistId,
        viewCount: 1,
        lastViewedAt: serverTimestamp(),
      };
      batch.set(viewRef, viewData);
      batch.update(doc(db, 'users', userId), { viewedCount: increment(1) });
    }

    // Always increment the view counter on the item itself
    batch.update(itemRef, { views: increment(1), viewsCount: increment(1) });

    await batch.commit();
  } catch (error) {
    console.error('Error recording view:', error);
    // Don't throw — views should never disrupt the user experience
  }
}

/**
 * Get user's view history.
 * OPTIMIZED: Uses Firestore orderBy + limit instead of fetching all and sorting in JS.
 */
export async function getUserViewHistory(userId: string, maxResults: number = 50): Promise<ViewData[]> {
  try {
    const snap = await getDocs(
      query(
        collection(db, 'view_history'),
        where('userId', '==', userId),
        orderBy('lastViewedAt', 'desc'),
        firestoreLimit(maxResults),
      )
    );
    return snap.docs.map(d => d.data() as ViewData);
  } catch (error) {
    console.error('Error fetching view history:', error);
    return [];
  }
}

/**
 * Returns cached count from the user doc — 1 read, not a collection scan.
 */
export async function getUserViewsCount(userId: string): Promise<number> {
  try {
    const userSnap = await getDoc(doc(db, 'users', userId));
    return userSnap.exists() ? (userSnap.data().viewedCount ?? 0) : 0;
  } catch (error) {
    console.error('Error fetching views count:', error);
    return 0;
  }
}

/**
 * Get unique items viewed by user.
 * OPTIMIZED: Reads from the deduplicated view_history (one doc per user-item pair).
 */
export async function getUserUniqueViewedItems(userId: string): Promise<string[]> {
  try {
    const snap = await getDocs(
      query(collection(db, 'view_history'), where('userId', '==', userId))
    );
    return snap.docs.map(d => d.data().itemId as string);
  } catch (error) {
    console.error('Error fetching unique viewed items:', error);
    return [];
  }
}

// ============================================================
// SHARES
// ============================================================

/**
 * Record a share. Also updates sharedCount on the user doc (cache).
 */
export async function recordShare(
  userId: string,
  itemId: string,
  itemType: 'portfolio' | 'listing',
  artistId: string,
  platform?: string
): Promise<void> {
  try {
    const shareId = `${userId}_${itemId}_${Date.now()}`;
    const shareRef = doc(db, 'user_shares', shareId);
    const itemRef = doc(db, itemType === 'portfolio' ? 'portfolios' : 'listings', itemId);

    const shareData: ShareData = {
      userId,
      itemId,
      itemType,
      artistId,
      sharedAt: serverTimestamp(),
      platform: platform || 'unknown',
    };

    const batch = writeBatch(db);
    batch.set(shareRef, shareData);
    batch.update(itemRef, { shares: increment(1), sharesCount: increment(1) });
    batch.update(doc(db, 'users', userId), { sharedCount: increment(1) });
    await batch.commit();
  } catch (error) {
    console.error('Error recording share:', error);
  }
}

export async function getUserShares(userId: string): Promise<ShareData[]> {
  try {
    const snap = await getDocs(query(collection(db, 'user_shares'), where('userId', '==', userId)));
    return snap.docs.map(d => d.data() as ShareData);
  } catch (error) {
    console.error('Error fetching user shares:', error);
    return [];
  }
}

/**
 * Returns cached count from the user doc — 1 read, not a collection scan.
 */
export async function getUserSharesCount(userId: string): Promise<number> {
  try {
    const userSnap = await getDoc(doc(db, 'users', userId));
    return userSnap.exists() ? (userSnap.data().sharedCount ?? 0) : 0;
  } catch (error) {
    console.error('Error fetching shares count:', error);
    return 0;
  }
}

// ============================================================
// FOLLOWING / FOLLOWERS
// ============================================================

/**
 * Toggle follow an artist. Updates followersCount/followingCount on both user docs.
 */
export async function toggleFollow(
  followerId: string,
  artistId: string
): Promise<boolean> {
  try {
    const followId = `${followerId}_${artistId}`;
    const followRef = doc(db, 'following', followId);
    const followSnap = await getDoc(followRef);

    const batch = writeBatch(db);
    const artistRef = doc(db, 'users', artistId);
    const userRef = doc(db, 'users', followerId);

    if (followSnap.exists()) {
      batch.delete(followRef);
      batch.update(artistRef, { followersCount: increment(-1) });
      batch.update(userRef, { followingCount: increment(-1) });
      await batch.commit();
      return false;
    } else {
      batch.set(followRef, { followerId, artistId, createdAt: serverTimestamp() });
      batch.update(artistRef, { followersCount: increment(1) });
      batch.update(userRef, { followingCount: increment(1) });
      await batch.commit();
      return true;
    }
  } catch (error) {
    console.error('Error toggling follow:', error);
    throw error;
  }
}

export async function isFollowing(followerId: string, artistId: string): Promise<boolean> {
  try {
    const followSnap = await getDoc(doc(db, 'following', `${followerId}_${artistId}`));
    return followSnap.exists();
  } catch (error) {
    console.error('Error checking follow status:', error);
    return false;
  }
}

/**
 * Returns cached count from the user doc — 1 read, not a collection scan.
 */
export async function getUserFollowingCount(userId: string): Promise<number> {
  try {
    const userSnap = await getDoc(doc(db, 'users', userId));
    return userSnap.exists() ? (userSnap.data().followingCount ?? 0) : 0;
  } catch (error) {
    console.error('Error fetching following count:', error);
    return 0;
  }
}

export async function getUserFollowing(userId: string): Promise<string[]> {
  try {
    const snap = await getDocs(
      query(
        collection(db, 'following'),
        where('followerId', '==', userId),
        firestoreLimit(200), // hard cap — safe for 150 user scale
      )
    );
    return snap.docs.map(d => d.data().artistId);
  } catch (error) {
    console.error('Error fetching following list:', error);
    return [];
  }
}

// ============================================================
// COMPREHENSIVE STATS — OPTIMIZED
// ============================================================

/**
 * Get all enthusiast stats in a SINGLE Firestore read.
 *
 * BEFORE: 5 separate collection scans (getDocs × 5)
 * AFTER:  1 doc read from users/{userId} which holds cached counters.
 *
 * Counters (likesCount, savesCount, followingCount, viewedCount, sharedCount)
 * are kept in sync by every toggle/record function above.
 */
export async function getEnthusiastStats(userId: string): Promise<EnthusiastStats> {
  try {
    const userSnap = await getDoc(doc(db, 'users', userId));
    if (!userSnap.exists()) {
      return { likes: 0, saved: 0, following: 0, viewed: 0, shared: 0 };
    }
    const data = userSnap.data();
    return {
      likes:     data.likesCount     ?? 0,
      saved:     data.savesCount     ?? 0,
      following: data.followingCount ?? 0,
      viewed:    data.viewedCount    ?? 0,
      shared:    data.sharedCount    ?? 0,
    };
  } catch (error) {
    console.error('Error fetching enthusiast stats:', error);
    return { likes: 0, saved: 0, following: 0, viewed: 0, shared: 0 };
  }
}

// ============================================================
// BATCH OPERATIONS
// ============================================================

/**
 * Clear all user activity (for account deletion).
 */
export async function clearUserActivity(userId: string): Promise<void> {
  try {
    const batch = writeBatch(db);

    const [likesSnap, savesSnap, viewsSnap, sharesSnap, followingSnap] = await Promise.all([
      getDocs(query(collection(db, 'user_likes'),   where('userId', '==', userId))),
      getDocs(query(collection(db, 'user_saves'),   where('userId', '==', userId))),
      getDocs(query(collection(db, 'view_history'), where('userId', '==', userId))),
      getDocs(query(collection(db, 'user_shares'),  where('userId', '==', userId))),
      getDocs(query(collection(db, 'following'),    where('followerId', '==', userId))),
    ]);

    likesSnap.docs.forEach(d => batch.delete(d.ref));
    savesSnap.docs.forEach(d => batch.delete(d.ref));
    viewsSnap.docs.forEach(d => batch.delete(d.ref));
    sharesSnap.docs.forEach(d => batch.delete(d.ref));
    followingSnap.docs.forEach(d => batch.delete(d.ref));

    // Reset cached counters on the user doc
    batch.update(doc(db, 'users', userId), {
      likesCount: 0,
      savesCount: 0,
      viewedCount: 0,
      sharedCount: 0,
      followingCount: 0,
    });

    await batch.commit();
  } catch (error) {
    console.error('Error clearing user activity:', error);
    throw error;
  }
}
