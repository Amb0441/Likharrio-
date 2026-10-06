import { Ionicons } from '@expo/vector-icons';
import { useGuardedRouter } from "../../utils/navigationGuard";
import {
  Modal, StyleSheet, Text, TouchableOpacity, TouchableWithoutFeedback, View,
} from 'react-native';
import COLORS from '../../constants/Colors';

interface Props {
  visible: boolean;
  onClose: () => void;
  title: string;
  message: string;
  actionLabel: string | null;
  actionRoute: string | null;
  isPending?: boolean;
}

export default function VerificationGateModal({
  visible, onClose, title, message, actionLabel, actionRoute, isPending,
}: Props) {
  const { guardedPush } = useGuardedRouter();

  const handleAction = () => {
    onClose();
    if (actionRoute) {
      guardedPush(actionRoute as any);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.card}>
              {/* Icon */}
              <View style={[styles.iconCircle, isPending && styles.iconCirclePending]}>
                <Ionicons
                  name={isPending ? 'time-outline' : 'shield-outline'}
                  size={36}
                  color={isPending ? '#1E40AF' : COLORS.primary.deepRed}
                />
              </View>

              <Text style={styles.title}>{title}</Text>
              <Text style={styles.message}>{message}</Text>

              {/* What's locked */}
              <View style={styles.lockedList}>
                {['Create listings', 'Add showcases', 'Host events'].map((item) => (
                  <View key={item} style={styles.lockedRow}>
                    <Ionicons name="lock-closed" size={13} color="#9CA3AF" />
                    <Text style={styles.lockedText}>{item}</Text>
                  </View>
                ))}
              </View>

              {/* Action button */}
              {actionLabel && actionRoute ? (
                <TouchableOpacity style={styles.actionBtn} onPress={handleAction}>
                  <Ionicons name="shield-checkmark-outline" size={18} color="#fff" />
                  <Text style={styles.actionBtnText}>{actionLabel}</Text>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity style={styles.dismissBtn} onPress={onClose}>
                <Text style={styles.dismissText}>
                  {isPending ? 'Got it' : 'Maybe Later'}
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 28,
  },
  card: {
    width: '100%', backgroundColor: '#fff', borderRadius: 24,
    padding: 28, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18, shadowRadius: 24, elevation: 12,
  },
  iconCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: '#FFF0F0',
    justifyContent: 'center', alignItems: 'center', marginBottom: 18,
  },
  iconCirclePending: { backgroundColor: '#DBEAFE' },

  title: {
    fontSize: 20, fontWeight: '800', color: '#1A1008',
    textAlign: 'center', marginBottom: 10,
  },
  message: {
    fontSize: 14, color: '#6B7280', textAlign: 'center',
    lineHeight: 21, marginBottom: 20, paddingHorizontal: 4,
  },

  lockedList: {
    width: '100%', backgroundColor: '#F9FAFB', borderRadius: 12,
    padding: 14, gap: 10, marginBottom: 22,
  },
  lockedRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  lockedText: { fontSize: 13, color: '#9CA3AF', fontWeight: '500' },

  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    width: '100%', backgroundColor: COLORS.primary.deepRed,
    paddingVertical: 15, borderRadius: 14, justifyContent: 'center',
    marginBottom: 10,
    shadowColor: COLORS.primary.deepRed, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 8, elevation: 4,
  },
  actionBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  dismissBtn: { paddingVertical: 10 },
  dismissText: { fontSize: 14, color: '#9CA3AF', fontWeight: '500' },
});
