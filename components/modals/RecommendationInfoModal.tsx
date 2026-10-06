import { Ionicons } from "@expo/vector-icons";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import COLORS from "../../constants/Colors";

interface RecommendationExplanation {
  title: string;
  reason: string;
  details: string[];
}

interface Props {
  visible: boolean;
  onClose: () => void;
  explanation: RecommendationExplanation;
}

export default function RecommendationInfoModal({ visible, onClose, explanation }: Props) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <View style={styles.titleContainer}>
              <Ionicons name="information-circle" size={24} color={COLORS.primary.deepRed} />
              <Text style={styles.title}>Why this recommendation?</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.itemHeader}>
              <Text style={styles.itemTitle}>{explanation.title}</Text>
              <View style={styles.reasonBadge}>
                <Text style={styles.reasonText}>{explanation.reason}</Text>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>How we chose this for you:</Text>
              {explanation.details.map((detail, index) => (
                <View key={index} style={styles.detailItem}>
                  <Ionicons name="checkmark-circle" size={20} color={COLORS.status.success.text} />
                  <Text style={styles.detailText}>{detail}</Text>
                </View>
              ))}
            </View>

            <View style={styles.infoSection}>
              <Ionicons name="bulb-outline" size={20} color="#F59E0B" />
              <Text style={styles.infoText}>
                Your recommendations improve as you interact with more artworks and artists.
                Like, save, and follow to help us understand your taste better!
              </Text>
            </View>
          </ScrollView>

          <TouchableOpacity style={styles.gotItButton} onPress={onClose}>
            <Text style={styles.gotItButtonText}>Got it!</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "80%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#000000",
  },
  titleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    color: COLORS.text.primary,
  },
  closeButton: {
    padding: 4,
  },
  content: {
    padding: 20,
  },
  itemHeader: {
    marginBottom: 24,
  },
  itemTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: COLORS.text.primary,
    marginBottom: 12,
  },
  reasonBadge: {
    backgroundColor: "#F0F9FF",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  reasonText: {
    fontSize: 12,
    color: "#0369A1",
    fontWeight: "600",
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text.primary,
    marginBottom: 16,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 12,
  },
  detailText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text.secondary,
    lineHeight: 20,
  },
  infoSection: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: "#FEF3C7",
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: "#92400E",
    lineHeight: 18,
  },
  gotItButton: {
    margin: 20,
    marginTop: 0,
    backgroundColor: COLORS.primary.deepRed,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  gotItButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
