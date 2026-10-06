import { Feather } from '@expo/vector-icons';
import { useGuardedRouter } from "../../utils/navigationGuard";
import { useState } from 'react';
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import VerificationGateModal from '../../components/ui/VerificationGateModal';
import { useArtistVerification } from '../../hooks/useArtistVerification';

export default function CreateSelection() {
  const { canCreate, isPending, blockMessage } = useArtistVerification();
  const [gateVisible, setGateVisible] = useState(false);
  const { guardedPush, guardedReplace } = useGuardedRouter();

  const handleBack = () => {
    guardedReplace('/(app)/artist/artist-home');
  };

  const tryNavigate = (path: string) => {
    if (!canCreate) { setGateVisible(true); return; }
    guardedPush(path as any);
  };

  const options = [
    {
      icon: 'grid' as const,
      title: 'Add Showcase',
      description: 'Showcase your artwork collection and creative journey',
      path: '/(app)/portfolio/create-portfolio',
    },
    {
      icon: 'tag' as const,
      title: 'List Item',
      description: 'Add your artwork to the marketplace for sale',
      path: '/(app)/marketplace/listing-items',
    },
    {
      icon: 'calendar' as const,
      title: 'Event',
      description: 'Host an exhibition or workshop for art enthusiasts',
      path: '/(app)/events/create-event',
    },
  ];

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAF7F2" />

      {/* ── Back button ── */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={handleBack} activeOpacity={0.7}>
          <Feather name="arrow-left" size={20} color="#2A1005" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={styles.headerSection}>
          <Text style={styles.title}>What would you{'\n'}like to create?</Text>
          <Text style={styles.subtitle}>Choose an option below</Text>
        </View>

        {/* ── Unverified notice ── */}
        {!canCreate && (
          <TouchableOpacity
            style={[
              styles.noticeBanner,
              isPending ? styles.noticeBannerPending : styles.noticeBannerWarn,
            ]}
            onPress={() => setGateVisible(true)}
            activeOpacity={0.8}
          >
            <Feather
              name={isPending ? 'clock' : 'alert-circle'}
              size={14}
              color={isPending ? '#1E40AF' : '#92400E'}
            />
            <Text style={[styles.noticeText, isPending && styles.noticeTextPending]}>
              {isPending
                ? 'Verification pending — creation locked'
                : 'Complete verification to create content'}
            </Text>
            {!isPending && <Feather name="chevron-right" size={14} color="#92400E" />}
          </TouchableOpacity>
        )}

        {/* ── Option cards ── */}
        <View style={styles.cardsContainer}>
          {options.map((opt) => (
            <TouchableOpacity
              key={opt.title}
              style={[styles.card, !canCreate && styles.cardLocked]}
              onPress={() => tryNavigate(opt.path)}
              activeOpacity={0.65}
            >
              {/* Icon */}
              <View style={styles.iconBox}>
                <Feather
                  name={opt.icon}
                  size={26}
                  color={canCreate ? '#8B1A1A' : '#9CA3AF'}
                />
              </View>

              {/* Divider */}
              <View style={styles.divider} />

              {/* Text */}
              <View style={styles.cardContent}>
                <Text style={[styles.cardTitle, !canCreate && styles.cardTitleLocked]}>
                  {opt.title}
                </Text>
                <Text style={styles.cardDescription}>{opt.description}</Text>
              </View>

              {/* Arrow */}
              <View style={styles.chevronBox}>
                <Feather
                  name={canCreate ? 'chevron-right' : 'lock'}
                  size={16}
                  color={canCreate ? '#8B1A1A' : '#D1D5DB'}
                />
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* ── Gate modal ── */}
      <VerificationGateModal
        visible={gateVisible}
        onClose={() => setGateVisible(false)}
        title={blockMessage.title}
        message={blockMessage.message}
        actionLabel={blockMessage.actionLabel}
        actionRoute={blockMessage.actionRoute}
        isPending={isPending}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FAF7F2',
  },

  // ── Top bar ──
  topBar: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#EDE0D4',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Scroll ──
  scroll: {
    paddingBottom: 40,
  },

  // ── Header ──
  headerSection: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 32,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: '#2A1005',
    lineHeight: 36,
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: '#9B8265',
  },

  // ── Notice banner ──
  noticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  noticeBannerWarn: { backgroundColor: '#FEF3C7' },
  noticeBannerPending: { backgroundColor: '#DBEAFE' },
  noticeText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#92400E',
  },
  noticeTextPending: { color: '#1E40AF' },

  // ── Cards ──
  cardsContainer: {
    paddingHorizontal: 20,
    gap: 16,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#EDE0D4',
    paddingVertical: 24,
    paddingHorizontal: 20,
    gap: 0,
    shadowColor: '#2A1005',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  cardLocked: {
    opacity: 0.65,
  },
  iconBox: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#FDF5F2',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    borderWidth: 1,
    borderColor: '#F0DDD8',
  },
  divider: {
    width: 1,
    height: 44,
    backgroundColor: '#EDE0D4',
    marginHorizontal: 18,
    flexShrink: 0,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#2A1005',
    marginBottom: 5,
    letterSpacing: -0.2,
  },
  cardTitleLocked: {
    color: '#9CA3AF',
  },
  cardDescription: {
    fontSize: 13,
    color: '#9B8265',
    lineHeight: 19,
  },
  chevronBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#FAF7F2',
    borderWidth: 1,
    borderColor: '#EDE0D4',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginLeft: 12,
  },
});
