import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import COLORS from "../../constants/Colors";

interface EmptyStateProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
}

export default function EmptyState({ icon, title, subtitle }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Ionicons name={icon} size={28} color={COLORS.text.muted} />
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    padding: 24,
    gap: 8,
  },
  title: {
    fontSize: 13,
    color: COLORS.text.muted,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 12,
    color: COLORS.text.muted,
    textAlign: "center",
    lineHeight: 18,
  },
});
