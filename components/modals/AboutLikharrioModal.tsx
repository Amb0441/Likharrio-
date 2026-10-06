import { Feather } from "@expo/vector-icons";
import {
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import COLORS from "../../constants/Colors";
import LikharrioLogo from "../ui/LikharrioLogo";

interface AboutLikharrioModalProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * Full-screen "About Likharrio" modal.
 * Shared between the artist and enthusiast profile screens.
 */
export default function AboutLikharrioModal({
  visible,
  onClose,
}: AboutLikharrioModalProps) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
        <StatusBar
          barStyle="dark-content"
          backgroundColor={COLORS.background.primary}
        />
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.closeIcon}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Feather name="x" size={20} color={COLORS.text.primary} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.logoWrap}>
            <LikharrioLogo size={110} />
          </View>

          <Text style={styles.title}>About Likharrio</Text>

          <Text style={styles.body}>
            Likharrio is a community built for Filipino artists and art
            enthusiasts — a place to showcase your craft, discover work
            rooted in Cordilleran heritage, and connect directly with the
            people who create it.
          </Text>
          <Text style={styles.body}>
            From painting and weaving to woodcraft and sculpture, every
            piece shared here helps keep local artistry visible,
            supported, and celebrated.
          </Text>

          <View style={styles.divider} />

          <View style={styles.pillarsRow}>
            <View style={styles.pillar}>
              <View style={styles.pillarIconBox}>
                <Feather
                  name="image"
                  size={18}
                  color={COLORS.primary.deepRed}
                />
              </View>
              <Text style={styles.pillarLabel}>Showcase</Text>
            </View>
            <View style={styles.pillar}>
              <View style={styles.pillarIconBox}>
                <Feather
                  name="users"
                  size={18}
                  color={COLORS.primary.deepRed}
                />
              </View>
              <Text style={styles.pillarLabel}>Connect</Text>
            </View>
            <View style={styles.pillar}>
              <View style={styles.pillarIconBox}>
                <Feather
                  name="shopping-bag"
                  size={18}
                  color={COLORS.primary.deepRed}
                />
              </View>
              <Text style={styles.pillarLabel}>Sell</Text>
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            activeOpacity={0.85}
          >
            <Text style={styles.closeBtnText}>Got it</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background.primary,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  closeIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: COLORS.border.primary,
    backgroundColor: COLORS.text.white,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    paddingHorizontal: 28,
    paddingTop: 24,
    paddingBottom: 40,
    alignItems: "center",
  },
  logoWrap: {
    marginBottom: 32,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: COLORS.text.primary,
    marginBottom: 16,
    letterSpacing: -0.2,
  },
  body: {
    fontSize: 15,
    lineHeight: 23,
    color: COLORS.text.secondary,
    textAlign: "center",
    marginBottom: 14,
  },
  divider: {
    height: 1,
    width: "100%",
    backgroundColor: COLORS.border.primary,
    marginTop: 12,
    marginBottom: 28,
  },
  pillarsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    gap: 12,
  },
  pillar: {
    flex: 1,
    alignItems: "center",
    gap: 10,
    backgroundColor: COLORS.background.secondary,
    borderRadius: 16,
    paddingVertical: 18,
    borderWidth: 1,
    borderColor: COLORS.border.light,
  },
  pillarIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.ui.showcaseSection,
    alignItems: "center",
    justifyContent: "center",
  },
  pillarLabel: {
    fontSize: 12.5,
    fontWeight: "700",
    color: COLORS.text.primary,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 8,
  },
  closeBtn: {
    width: "100%",
    backgroundColor: COLORS.primary.deepRed,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    shadowColor: COLORS.primary.deepRed,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  closeBtnText: {
    color: COLORS.text.white,
    fontSize: 15,
    fontWeight: "700",
  },
});
