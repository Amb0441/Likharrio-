import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import COLORS from "../../constants/Colors";

interface FilterBarProps {
  categories: string[];
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
}

export default function FilterBar({
  categories,
  selectedCategory,
  onSelectCategory,
}: FilterBarProps) {
  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {categories.map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[
              styles.chip,
              selectedCategory === cat && styles.chipActive,
            ]}
            onPress={() => onSelectCategory(cat)}
          >
            <Text
              style={[
                styles.chipText,
                selectedCategory === cat && styles.chipTextActive,
              ]}
            >
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 12,
  },
  content: {
    paddingHorizontal: 20,
    gap: 8,
    alignItems: "center",
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: COLORS.text.white,
    borderWidth: 1.5,
    borderColor: COLORS.border.primary,
  },
  chipActive: {
    backgroundColor: COLORS.primary.deepRed,
    borderColor: COLORS.primary.deepRed,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.text.secondary,
  },
  chipTextActive: {
    color: COLORS.text.white,
    fontWeight: "800",
  },
});
