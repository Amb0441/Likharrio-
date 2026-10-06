import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import COLORS from "../../constants/Colors";

interface LoadingIndicatorProps {
  text?: string;
  color?: string;
}

export default function LoadingIndicator({
  text,
  color = COLORS.primary.deepRed,
}: LoadingIndicatorProps) {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="small" color={color} />
      {text && <Text style={styles.text}>{text}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    gap: 10,
  },
  text: {
    fontSize: 13,
    color: COLORS.text.muted,
  },
});
