import { useAuth } from '../contexts/AuthContext';

/**
 * Returns whether the current artist is allowed to create/publish content.
 * Only 'approved' artists with verified: true can create.
 */
export function useArtistVerification() {
  const { userProfile } = useAuth();

  const status = userProfile?.artistStatus ?? 'unsubmitted';
  const isVerified = status === 'approved' && userProfile?.verified === true;
  const isPending = status === 'pending';
  const isRejected = status === 'rejected';
  const isUnsubmitted = status === 'unsubmitted' || !status;

  const canCreate = isVerified;

  const blockMessage = isPending
    ? {
        title: 'Verification Pending ⏳',
        message:
          `Your verification is currently under review. You'll be notified once approved — usually 1–3 business days.`,
        actionLabel: null,
        actionRoute: null,
      }
    : isRejected
    ? {
        title: 'Verification Not Approved',
        message:
          'Your verification was not approved. Please resubmit your documents to unlock listings, showcases, and events.',
        actionLabel: 'Resubmit Documents',
        actionRoute: '/(app)/artist/artist-verification',
      }
    : {
        title: 'Verification Required 🔒',
        message:
          'Complete your artist verification to unlock the ability to create listings, showcases, and events.',
        actionLabel: 'Get Verified Now',
        actionRoute: '/(app)/artist/artist-verification',
      };

  return {
    canCreate,
    status,
    isPending,
    isRejected,
    isUnsubmitted,
    isVerified,
    blockMessage,
  };
}
