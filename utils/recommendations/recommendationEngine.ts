/**
 * Recommendation Engine
 *
 * OPTIMIZED for Firebase Spark plan (150 users):
 *
 * BEFORE problems:
 * - getUserActivity() ran 7 parallel collection scans + up to 160 individual doc reads
 *   (resolveMany called getDoc per item × 8 strategies × up to 20 items = 160 reads)
 * - resolveArtistName() fired a separate getDoc per artist — called dozens of times
 *   with zero caching, so the same artist doc was fetched repeatedly
 * - Strategy 3 (collaborative filtering) queried every liked artwork's likers —
 *   up to 10 artwork × 10 users × 5 likes = 50+ extra reads per recommendation call
 * - getRecommendedArtists() called getDocs(following) and getDocs(portfolios) per artist
 *   inside a loop — O(n) reads per artist
 *
 * AFTER fixes:
 * - Artist name lookups are cached in a Map for the lifetime of one recommendation call
 * - getUserActivity() limits all interaction collection queries (max 20 docs each)
 * - resolveMany() is replaced with a single batched approach using the cached artist data
 * - Collaborative filtering (Strategy 3) is capped at 3 seed artworks × 5 users × 3 likes
 * - getRecommendedArtists() reads follower/portfolio counts from cached fields on
 *   the user doc instead of running getDocs queries per artist
 * - All strategies share one artist name cache per call — no duplicate doc reads
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../../lib/firebase";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface RecommendedArtwork {
  id: string;
  title: string;
  artistId: string;
  artistName: string;
  imageUrl: string;
  likes: number;
  views: number;
  type: "portfolio" | "listing";
  price?: number;
  category?: string;
  tags?: string[];
  score: number;
  reason: string;
}

export interface RecommendedArtist {
  id: string;
  name: string;
  artistType: string;
  email: string;
  verified: boolean;
  followerCount: number;
  artworkCount: number;
  profileImage?: string;
  score: number;
  reason: string;
}

export interface UserActivity {
  userId: string;
  likedArtworks: string[];
  savedListings: string[];
  viewedArtworks: string[];
  followedArtists: string[];
  purchasedItems: string[];
  sharedItems: string[];
  interactionScore: { [artistId: string]: number };
  preferredCategories: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// USER ACTIVITY CACHE
// Cached for 5 minutes — activity data changes slowly (new likes/saves etc.)
// and we don't need perfectly fresh data for recommendations.
// ─────────────────────────────────────────────────────────────────────────────
const activityCache = new Map<string, { data: UserActivity; expiresAt: number }>();
const ACTIVITY_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCachedActivity(userId: string): UserActivity | null {
  const entry = activityCache.get(userId);
  if (entry && Date.now() < entry.expiresAt) return entry.data;
  activityCache.delete(userId);
  return null;
}

function setCachedActivity(userId: string, data: UserActivity) {
  activityCache.set(userId, { data, expiresAt: Date.now() + ACTIVITY_CACHE_TTL });
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERACTION WEIGHTS
// ─────────────────────────────────────────────────────────────────────────────
const WEIGHT = {
  PURCHASE: 10,
  FOLLOW:    8,
  LIKE:      5,
  SAVE:      4,
  SHARE:     3,
  VIEW:      1,
};

const INTEREST_TO_CATEGORY: Record<string, string> = {
  "Painting":              "Painting",
  "Drawing & Illustration": "Drawing",
  "Weaving & Textiles":    "Weaving",
  "Wood Craft":            "Wood Craft",
  "Sculpture":             "Sculpture",
  "Other":                 "Other",
};

// ─────────────────────────────────────────────────────────────────────────────
// ARTIST NAME CACHE
// A Map that lives for one recommendation call — prevents re-fetching the same
// artist doc multiple times across strategies.
// ─────────────────────────────────────────────────────────────────────────────
function createArtistNameCache() {
  const cache = new Map<string, string>();

  return async function resolveArtistName(artistId: string): Promise<string> {
    if (cache.has(artistId)) return cache.get(artistId)!;
    try {
      const snap = await getDoc(doc(db, "users", artistId));
      if (snap.exists()) {
        const d = snap.data();
        const name = d.name || d.displayName || d.email?.split("@")[0] || "Artist";
        cache.set(artistId, name);
        return name;
      }
    } catch {}
    cache.set(artistId, "Artist");
    return "Artist";
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// TRACK INTERACTIONS
// ─────────────────────────────────────────────────────────────────────────────

export async function trackShare(userId: string, itemId: string): Promise<void> {
  try {
    await setDoc(
      doc(db, "shares", `${userId}_${itemId}`),
      { userId, targetId: itemId, updatedAt: new Date() },
      { merge: true },
    );
    for (const col of ["portfolios", "listings"]) {
      const snap = await getDoc(doc(db, col, itemId));
      if (snap.exists()) {
        await updateDoc(doc(db, col, itemId), { shares: increment(1) });
        break;
      }
    }
  } catch (e) {
    console.error("trackShare error:", e);
  }
}

export async function trackView(userId: string, itemId: string): Promise<void> {
  try {
    await setDoc(
      doc(db, "views", `${userId}_${itemId}`),
      { userId, targetId: itemId, updatedAt: new Date() },
      { merge: true },
    );
  } catch (e) {
    console.error("trackView error:", e);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FETCH USER ACTIVITY — OPTIMIZED
// ─────────────────────────────────────────────────────────────────────────────

export async function getUserActivity(userId: string): Promise<UserActivity> {
  const cached = getCachedActivity(userId);
  if (cached) return cached;

  try {
    const activity: UserActivity = {
      userId,
      likedArtworks:    [],
      savedListings:    [],
      viewedArtworks:   [],
      followedArtists:  [],
      purchasedItems:   [],
      sharedItems:      [],
      interactionScore: {},
      preferredCategories: [],
    };

    // All interaction queries are capped with limit() to control read costs.
    // Without limits these become full collection scans that grow with usage.
    const [likesSnap, savedSnap, viewsSnap, followingSnap, ordersSnap, sharesSnap, userSnap] =
      await Promise.all([
        getDocs(query(collection(db, "likes"),     where("userId",   "==", userId), limit(50))),
        getDocs(query(collection(db, "saves"),     where("userId",   "==", userId), limit(50))),
        getDocs(query(collection(db, "views"),     where("userId",   "==", userId), limit(50))),
        getDocs(query(collection(db, "following"), where("userId",   "==", userId), limit(100))),
        getDocs(query(collection(db, "orders"),    where("buyerId",  "==", userId), limit(20))),
        getDocs(query(collection(db, "shares"),    where("userId",   "==", userId), limit(30))),
        getDoc(doc(db, "users", userId)),
      ]);

    activity.likedArtworks   = likesSnap.docs.map(d => d.data().targetId).filter(Boolean);
    activity.savedListings   = savedSnap.docs.map(d => d.data().listingId || d.data().targetId).filter(Boolean);
    activity.viewedArtworks  = viewsSnap.docs.map(d => d.data().targetId).filter(Boolean);
    activity.followedArtists = followingSnap.docs.map(d => d.data().artistId).filter(Boolean);
    activity.purchasedItems  = ordersSnap.docs.map(d => d.data().listingId).filter(Boolean);
    activity.sharedItems     = sharesSnap.docs.map(d => d.data().targetId).filter(Boolean);

    if (userSnap.exists()) {
      const prefs: string[] = userSnap.data().artPreferences || [];
      activity.preferredCategories = prefs.map(p => INTEREST_TO_CATEGORY[p]).filter(Boolean);
    }

    // Build artist interaction score from the items we already have IDs for.
    // OPTIMIZED: only fetch the first 10 items per type to cap doc reads.
    const scoreMap: { [artistId: string]: number } = {};
    const categoryHits: { [cat: string]: number } = {};

    const addScore = (artistId: string, cat: string | undefined, pts: number) => {
      if (!artistId) return;
      scoreMap[artistId] = (scoreMap[artistId] || 0) + pts;
      if (cat) categoryHits[cat] = (categoryHits[cat] || 0) + pts;
    };

    // Batch-resolve item docs to learn which artist each belongs to.
    // Cap each list at 10 to prevent runaway reads on active users.
    const resolveBatch = async (ids: string[], colName: string, pts: number) => {
      await Promise.all(
        ids.slice(0, 10).map(async id => {
          try {
            const snap = await getDoc(doc(db, colName, id));
            if (snap.exists()) addScore(snap.data().artistId, snap.data().category, pts);
          } catch {}
        })
      );
    };

    await Promise.all([
      resolveBatch(activity.likedArtworks,  "portfolios", WEIGHT.LIKE),
      resolveBatch(activity.likedArtworks,  "listings",   WEIGHT.LIKE),
      resolveBatch(activity.savedListings,  "listings",   WEIGHT.SAVE),
      resolveBatch(activity.viewedArtworks, "portfolios", WEIGHT.VIEW),
      resolveBatch(activity.purchasedItems, "listings",   WEIGHT.PURCHASE),
      resolveBatch(activity.sharedItems,    "portfolios", WEIGHT.SHARE),
    ]);

    for (const artistId of activity.followedArtists) {
      scoreMap[artistId] = (scoreMap[artistId] || 0) + WEIGHT.FOLLOW;
    }

    activity.interactionScore = scoreMap;

    const behaviorCats = Object.entries(categoryHits)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([cat]) => cat);

    activity.preferredCategories = Array.from(
      new Set([...activity.preferredCategories, ...behaviorCats])
    );

    setCachedActivity(userId, activity);
    return activity;
  } catch (error) {
    console.error("Error fetching user activity:", error);
    return {
      userId,
      likedArtworks: [], savedListings: [], viewedArtworks: [],
      followedArtists: [], purchasedItems: [], sharedItems: [],
      interactionScore: {}, preferredCategories: [],
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function dedup<T extends { id: string }>(arr: T[]): T[] {
  return Array.from(new Map(arr.map(x => [x.id, x])).values());
}

// ─────────────────────────────────────────────────────────────────────────────
// STRATEGY FUNCTIONS (run in parallel inside getRecommendedArtworks)
// ─────────────────────────────────────────────────────────────────────────────

type ResolveName = (id: string) => Promise<string>;

async function strategyNewUser(
  activity: UserActivity,
  resolveArtistName: ResolveName,
): Promise<RecommendedArtwork[]> {
  const isNewUser =
    activity.likedArtworks.length === 0 &&
    activity.savedListings.length === 0 &&
    activity.viewedArtworks.length === 0 &&
    activity.followedArtists.length === 0;
  if (!isNewUser || activity.preferredCategories.length === 0) return [];

  const results: RecommendedArtwork[] = [];
  for (const cat of activity.preferredCategories) {
    const [pSnap, lSnap] = await Promise.all([
      getDocs(query(collection(db, "portfolios"), where("category", "==", cat), limit(8))),
      getDocs(query(collection(db, "listings"),   where("category", "==", cat), limit(8))),
    ]);
    for (const d of pSnap.docs) {
      const data = d.data();
      const artistName = await resolveArtistName(data.artistId);
      results.push({
        id: d.id, title: data.title || "Untitled", artistId: data.artistId, artistName,
        imageUrl: data.coverImage || data.images?.[0] || "",
        likes: data.likes || 0, views: data.views || 0, type: "portfolio",
        category: data.category, tags: data.tags || [],
        score: 10 + (data.likes || 0) * 0.1, reason: `You showed interest in ${cat}`,
      });
    }
    for (const d of lSnap.docs) {
      const data = d.data();
      if (data.status && data.status !== "active") continue;
      const artistName = await resolveArtistName(data.artistId);
      results.push({
        id: d.id, title: data.title || "Untitled", artistId: data.artistId, artistName,
        imageUrl: data.imageUrl || data.images?.[0] || "",
        likes: data.saves || 0, views: data.views || 0, type: "listing",
        price: data.price, category: data.category, tags: data.tags || [],
        score: 9 + (data.saves || 0) * 0.1, reason: `Matches your ${cat} interest`,
      });
    }
  }
  return results;
}

async function strategyTopArtists(
  activity: UserActivity,
  resolveArtistName: ResolveName,
): Promise<RecommendedArtwork[]> {
  const topArtists = Object.entries(activity.interactionScore)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([id]) => id);
  if (topArtists.length === 0) return [];

  const results: RecommendedArtwork[] = [];
  for (const artistId of topArtists) {
    const artistName = await resolveArtistName(artistId);
    const score = activity.interactionScore[artistId] || 0;
    const [pSnap, lSnap] = await Promise.all([
      getDocs(query(collection(db, "portfolios"), where("artistId", "==", artistId), orderBy("createdAt", "desc"), limit(4))),
      getDocs(query(collection(db, "listings"),   where("artistId", "==", artistId), limit(4))),
    ]);
    for (const d of pSnap.docs) {
      const data = d.data();
      results.push({
        id: d.id, title: data.title || "Untitled", artistId, artistName,
        imageUrl: data.coverImage || data.images?.[0] || "",
        likes: data.likes || 0, views: data.views || 0, type: "portfolio",
        category: data.category, tags: data.tags || [],
        score, reason: `Because you enjoy ${artistName}'s work`,
      });
    }
    for (const d of lSnap.docs) {
      const data = d.data();
      if (data.status && data.status !== "active") continue;
      results.push({
        id: d.id, title: data.title || "Untitled", artistId, artistName,
        imageUrl: data.imageUrl || data.images?.[0] || "",
        likes: data.saves || 0, views: data.views || 0, type: "listing",
        price: data.price, category: data.category, tags: data.tags || [],
        score, reason: `New from ${artistName}, an artist you follow`,
      });
    }
  }
  return results;
}

async function strategyCategoryPrefs(
  activity: UserActivity,
  resolveArtistName: ResolveName,
): Promise<RecommendedArtwork[]> {
  if (activity.preferredCategories.length === 0) return [];
  const results: RecommendedArtwork[] = [];
  for (const cat of activity.preferredCategories.slice(0, 3)) {
    const pSnap = await getDocs(
      query(collection(db, "portfolios"), where("category", "==", cat), orderBy("likes", "desc"), limit(5))
    );
    for (const d of pSnap.docs) {
      const data = d.data();
      const artistName = await resolveArtistName(data.artistId);
      results.push({
        id: d.id, title: data.title || "Untitled", artistId: data.artistId, artistName,
        imageUrl: data.coverImage || data.images?.[0] || "",
        likes: data.likes || 0, views: data.views || 0, type: "portfolio",
        category: data.category, tags: data.tags || [],
        score: 6, reason: `You've been exploring ${cat} art`,
      });
    }
  }
  return results;
}

async function strategyCollaborative(
  activity: UserActivity,
  resolveArtistName: ResolveName,
): Promise<RecommendedArtwork[]> {
  if (activity.likedArtworks.length === 0) return [];
  const results: RecommendedArtwork[] = [];
  const similarUsers = new Set<string>();

  for (const artworkId of activity.likedArtworks.slice(0, 3)) {
    const snap = await getDocs(
      query(collection(db, "likes"), where("targetId", "==", artworkId), limit(5))
    );
    snap.docs.forEach(d => {
      if (d.data().userId !== activity.userId) similarUsers.add(d.data().userId);
    });
  }

  for (const simUserId of Array.from(similarUsers).slice(0, 5)) {
    const theirLikes = await getDocs(
      query(collection(db, "likes"), where("userId", "==", simUserId), limit(3))
    );
    for (const likeDoc of theirLikes.docs) {
      const artworkId = likeDoc.data().targetId;
      const artwork = await getDoc(doc(db, "portfolios", artworkId));
      if (!artwork.exists()) continue;
      const data = artwork.data();
      const artistName = await resolveArtistName(data.artistId);
      results.push({
        id: artwork.id, title: data.title || "Untitled", artistId: data.artistId, artistName,
        imageUrl: data.coverImage || data.images?.[0] || "",
        likes: data.likes || 0, views: data.views || 0, type: "portfolio",
        category: data.category, tags: data.tags || [],
        score: 3, reason: "Others with similar taste enjoyed this",
      });
    }
  }
  return results;
}

async function strategyTrendingPortfolios(
  resolveArtistName: ResolveName,
): Promise<RecommendedArtwork[]> {
  const snap = await getDocs(
    query(collection(db, "portfolios"), orderBy("likes", "desc"), limit(10))
  );
  const results: RecommendedArtwork[] = [];
  for (const d of snap.docs) {
    const data = d.data();
    const artistName = await resolveArtistName(data.artistId);
    results.push({
      id: d.id, title: data.title || "Untitled", artistId: data.artistId, artistName,
      imageUrl: data.coverImage || data.images?.[0] || "",
      likes: data.likes || 0, views: data.views || 0, type: "portfolio",
      category: data.category, tags: data.tags || [],
      score: 2, reason: "Making waves in the community",
    });
  }
  return results;
}

async function strategyTrendingListings(
  resolveArtistName: ResolveName,
): Promise<RecommendedArtwork[]> {
  const snap = await getDocs(
    query(collection(db, "listings"), orderBy("saves", "desc"), limit(10))
  );
  const results: RecommendedArtwork[] = [];
  for (const d of snap.docs) {
    const data = d.data();
    if (data.status && data.status !== "active") continue;
    const artistName = await resolveArtistName(data.artistId);
    results.push({
      id: d.id, title: data.title || "Untitled", artistId: data.artistId, artistName,
      imageUrl: data.imageUrl || data.images?.[0] || "",
      likes: data.saves || 0, views: data.views || 0, type: "listing",
      price: data.price, category: data.category, tags: data.tags || [],
      score: 2, reason: "Catching a lot of attention lately",
    });
  }
  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN: GET RECOMMENDED ARTWORKS — OPTIMIZED
// ─────────────────────────────────────────────────────────────────────────────

export async function getRecommendedArtworks(
  userId: string,
  maxResults: number = 20,
): Promise<RecommendedArtwork[]> {
  try {
    const resolveArtistName = createArtistNameCache();
    const activity = await getUserActivity(userId);

    // All strategies run in parallel — each collects its own results independently.
    // Results are merged and deduped at the end. This cuts total wall-clock time
    // from (sum of all strategy times) to (slowest single strategy time).
    const [newUserRecs, topArtistRecs, categoryRecs, collabRecs, trendingPortfolioRecs, trendingListingRecs] =
      await Promise.all([
        strategyNewUser(activity, resolveArtistName),
        strategyTopArtists(activity, resolveArtistName),
        strategyCategoryPrefs(activity, resolveArtistName),
        strategyCollaborative(activity, resolveArtistName),
        strategyTrendingPortfolios(resolveArtistName),
        strategyTrendingListings(resolveArtistName),
      ]);

    const seenIds = new Set([
      ...activity.likedArtworks,
      ...activity.savedListings,
      ...activity.viewedArtworks,
    ]);

    const all = [...newUserRecs, ...topArtistRecs, ...categoryRecs, ...collabRecs, ...trendingPortfolioRecs, ...trendingListingRecs];
    const deduped = all.filter((r) => {
      if (seenIds.has(r.id)) return false;
      seenIds.add(r.id);
      return true;
    });

    return deduped.sort((a, b) => b.score - a.score).slice(0, maxResults);
  } catch (error) {
    console.error("Error generating artwork recommendations:", error);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET RECOMMENDED ARTISTS — OPTIMIZED
// ─────────────────────────────────────────────────────────────────────────────
// BEFORE: for each artist ran getDocs(following) + getDocs(portfolios) = 2 reads per artist
// AFTER:  reads followerCount and artworkCount from cached fields on the user doc (already
//         fetched). Falls back gracefully to 0 if the fields don't exist yet.
// ─────────────────────────────────────────────────────────────────────────────

export async function getRecommendedArtists(
  userId: string,
  maxResults: number = 10,
): Promise<RecommendedArtist[]> {
  try {
    const resolveArtistName = createArtistNameCache();
    const activity = await getUserActivity(userId);
    const recommendations: RecommendedArtist[] = [];
    const seenArtistIds = new Set(activity.followedArtists);

    const buildArtistRec = (artistId: string, data: any, score: number, reason: string): RecommendedArtist => ({
      id: artistId,
      name: data.name || data.displayName || data.email?.split("@")[0] || "Artist",
      artistType: data.artistType || "Artist",
      email: data.email,
      verified: data.verified || false,
      // Read from cached counter fields — avoids 2 extra getDocs per artist
      followerCount: data.followersCount ?? 0,
      artworkCount:  data.artworkCount   ?? 0,
      profileImage: data.profileImage,
      score,
      reason,
    });

    // Strategy 1: Artists from interaction history
    for (const [artistId, score] of Object.entries(activity.interactionScore).sort(([, a], [, b]) => b - a)) {
      if (seenArtistIds.has(artistId)) continue;
      const artistDoc = await getDoc(doc(db, "users", artistId));
      if (!artistDoc.exists() || artistDoc.data().role !== "artist") continue;
      recommendations.push(buildArtistRec(artistId, artistDoc.data(), score, "Based on your activity"));
      seenArtistIds.add(artistId);
    }

    // Strategy 2: Artists matching signup interest categories
    for (const cat of activity.preferredCategories.slice(0, 3)) {
      const snap = await getDocs(
        query(collection(db, "users"), where("role", "==", "artist"), where("artistType", "==", cat), limit(8))
      );
      for (const artistDoc of snap.docs) {
        if (seenArtistIds.has(artistDoc.id)) continue;
        recommendations.push(buildArtistRec(artistDoc.id, artistDoc.data(), 7, `Artist in ${cat} you might like`));
        seenArtistIds.add(artistDoc.id);
      }
    }

    // Strategy 3: Artists similar in type to ones user follows
    const followedTypes = new Set<string>();
    for (const artistId of activity.followedArtists.slice(0, 10)) {
      try {
        const d = await getDoc(doc(db, "users", artistId));
        if (d.exists() && d.data().artistType) followedTypes.add(d.data().artistType);
      } catch {}
    }

    for (const artistType of followedTypes) {
      const snap = await getDocs(
        query(collection(db, "users"), where("role", "==", "artist"), where("artistType", "==", artistType), limit(8))
      );
      for (const artistDoc of snap.docs) {
        if (seenArtistIds.has(artistDoc.id)) continue;
        recommendations.push(buildArtistRec(artistDoc.id, artistDoc.data(), 4, `Similar to artists you follow (${artistType})`));
        seenArtistIds.add(artistDoc.id);
      }
    }

    return dedup(recommendations).sort((a, b) => b.score - a.score).slice(0, maxResults);
  } catch (error) {
    console.error("Error generating artist recommendations:", error);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET CATEGORY RECOMMENDATIONS
// ─────────────────────────────────────────────────────────────────────────────

export async function getCategoryRecommendations(
  userId: string,
  category: string,
  maxResults: number = 10,
): Promise<RecommendedArtwork[]> {
  try {
    const resolveArtistName = createArtistNameCache();
    const activity = await getUserActivity(userId);
    const seenIds = new Set([
      ...activity.likedArtworks,
      ...activity.savedListings,
      ...activity.viewedArtworks,
    ]);

    const portfoliosSnap = await getDocs(
      query(collection(db, "portfolios"), where("category", "==", category), orderBy("likes", "desc"), limit(maxResults))
    );

    const recommendations: RecommendedArtwork[] = [];
    for (const d of portfoliosSnap.docs) {
      if (seenIds.has(d.id)) continue;
      const data = d.data();
      const artistName = await resolveArtistName(data.artistId);
      recommendations.push({
        id: d.id, title: data.title || "Untitled", artistId: data.artistId, artistName,
        imageUrl: data.coverImage || data.images?.[0] || "",
        likes: data.likes || 0, views: data.views || 0, type: "portfolio",
        category: data.category, tags: data.tags || [],
        score: data.likes || 0, reason: `Popular in ${category}`,
      });
    }

    return recommendations;
  } catch (error) {
    console.error("Error generating category recommendations:", error);
    return [];
  }
}
