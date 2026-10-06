/**
 * Custom Hook for User Activity
 * Provides easy access to like, save, view, share, and follow functionality
 */

import { useState, useEffect, useCallback } from 'react';
import {
  toggleLike,
  toggleSave,
  toggleFollow,
  hasUserLiked,
  hasUserSaved,
  isFollowing,
  recordView,
  recordShare,
  getEnthusiastStats,
  type EnthusiastStats,
} from '../lib/services/userActivity';
import { useAuth } from '../contexts/AuthContext';

interface UseUserActivityProps {
  itemId?: string;
  itemType?: 'portfolio' | 'listing';
  artistId?: string;
}

export function useUserActivity(props?: UseUserActivityProps) {
  const { user } = useAuth();
  const { itemId, itemType, artistId } = props || {};

  // States for current item
  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isFollowingArtist, setIsFollowingArtist] = useState(false);
  const [loading, setLoading] = useState(false);

  // Overall stats
  const [stats, setStats] = useState<EnthusiastStats>({
    likes: 0,
    saved: 0,
    following: 0,
    viewed: 0,
    shared: 0,
  });

  // Check initial states for the item
  useEffect(() => {
    if (user && itemId) {
      checkItemStates();
    }
  }, [user, itemId]);

  // Check if user has already liked, saved, or following the artist
  const checkItemStates = async () => {
    if (!user || !itemId) return;

    try {
      const [liked, saved, following] = await Promise.all([
        hasUserLiked(user.uid, itemId),
        hasUserSaved(user.uid, itemId),
        artistId ? isFollowing(user.uid, artistId) : Promise.resolve(false),
      ]);

      setIsLiked(liked);
      setIsSaved(saved);
      setIsFollowingArtist(following);
    } catch (error) {
      console.error('Error checking item states:', error);
    }
  };

  // Load user stats
  const loadStats = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      const userStats = await getEnthusiastStats(user.uid);
      setStats(userStats);
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Toggle Like
  const handleToggleLike = async () => {
    if (!user || !itemId || !itemType || !artistId) {
      throw new Error('Missing required parameters for like');
    }

    try {
      setLoading(true);
      const newLikeState = await toggleLike(user.uid, itemId, itemType, artistId);
      setIsLiked(newLikeState);
      
      // Update stats
      setStats(prev => ({
        ...prev,
        likes: newLikeState ? prev.likes + 1 : prev.likes - 1,
      }));

      return newLikeState;
    } catch (error) {
      console.error('Error toggling like:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Toggle Save
  const handleToggleSave = async () => {
    if (!user || !itemId || !itemType || !artistId) {
      throw new Error('Missing required parameters for save');
    }

    try {
      setLoading(true);
      const newSaveState = await toggleSave(user.uid, itemId, itemType, artistId);
      setIsSaved(newSaveState);
      
      // Update stats
      setStats(prev => ({
        ...prev,
        saved: newSaveState ? prev.saved + 1 : prev.saved - 1,
      }));

      return newSaveState;
    } catch (error) {
      console.error('Error toggling save:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Toggle Follow
  const handleToggleFollow = async (targetArtistId?: string) => {
    const targetId = targetArtistId || artistId;
    if (!user || !targetId) {
      throw new Error('Missing required parameters for follow');
    }

    try {
      setLoading(true);
      const newFollowState = await toggleFollow(user.uid, targetId);
      
      if (targetId === artistId) {
        setIsFollowingArtist(newFollowState);
      }
      
      // Update stats
      setStats(prev => ({
        ...prev,
        following: newFollowState ? prev.following + 1 : prev.following - 1,
      }));

      return newFollowState;
    } catch (error) {
      console.error('Error toggling follow:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Record View
  const handleRecordView = async (viewItemId?: string, viewItemType?: 'portfolio' | 'listing', viewArtistId?: string) => {
    const targetItemId = viewItemId || itemId;
    const targetItemType = viewItemType || itemType;
    const targetArtistId = viewArtistId || artistId;

    if (!user || !targetItemId || !targetItemType || !targetArtistId) {
      console.warn('Missing parameters for recording view');
      return;
    }

    try {
      await recordView(user.uid, targetItemId, targetItemType, targetArtistId);
      
      // Update stats
      setStats(prev => ({
        ...prev,
        viewed: prev.viewed + 1,
      }));
    } catch (error) {
      console.error('Error recording view:', error);
      // Don't throw - views should not disrupt user experience
    }
  };

  // Record Share
  const handleRecordShare = async (
    platform: string,
    shareItemId?: string,
    shareItemType?: 'portfolio' | 'listing',
    shareArtistId?: string
  ) => {
    const targetItemId = shareItemId || itemId;
    const targetItemType = shareItemType || itemType;
    const targetArtistId = shareArtistId || artistId;

    if (!user || !targetItemId || !targetItemType || !targetArtistId) {
      console.warn('Missing parameters for recording share');
      return;
    }

    try {
      await recordShare(user.uid, targetItemId, targetItemType, targetArtistId, platform);
      
      // Update stats
      setStats(prev => ({
        ...prev,
        shared: prev.shared + 1,
      }));
    } catch (error) {
      console.error('Error recording share:', error);
      // Don't throw - shares should not disrupt user experience
    }
  };

  return {
    // States
    isLiked,
    isSaved,
    isFollowingArtist,
    loading,
    stats,

    // Actions
    toggleLike: handleToggleLike,
    toggleSave: handleToggleSave,
    toggleFollow: handleToggleFollow,
    recordView: handleRecordView,
    recordShare: handleRecordShare,
    loadStats,
    refreshItemStates: checkItemStates,
  };
}
