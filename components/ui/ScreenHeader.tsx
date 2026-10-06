import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import COLORS from "../../constants/Colors";

interface ScreenHeaderProps {
  greeting: string;
  userName: string;
  notificationCount?: number;
  onNotificationPress?: () => void;
  plain?: boolean;
}

export default function ScreenHeader({
  greeting,
  userName,
  notificationCount = 0,
  onNotificationPress,
  plain = false,
}: ScreenHeaderProps) {
  return (
    <View style={[styles.container, plain && styles.plain]}>
      <View>
        <Text style={styles.greeting}>{greeting}</Text>
        <Text style={styles.name}>{userName || "User"}</Text>
      </View>

      {onNotificationPress && (
        <TouchableOpacity
          style={styles.notifBtn}
          onPress={onNotificationPress}
        >
          <Ionicons
            name="notifications-outline"
            size={22}
            color={COLORS.text.primary}
          />
          {notificationCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {notificationCount > 99 ? "99+" : notificationCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: COLORS.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.primary,
  },
  plain: {
    borderBottomWidth: 0,
    backgroundColor: "transparent",
    paddingBottom: 0,
  },
  greeting: {
    fontSize: 12,
    color: COLORS.text.muted,
    fontWeight: "500",
    marginBottom: 2,
  },
  name: {
    fontSize: 20,
    fontWeight: "800",
    color: COLORS.text.primary,
    letterSpacing: -0.3,
  },
  notifBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.text.white,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: COLORS.border.primary,
    position: "relative",
  },
  badge: {
    position: "absolute",
    top: -2,
    right: -2,
    backgroundColor: COLORS.primary.deepRed,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  badgeText: {
    color: COLORS.text.white,
    fontSize: 9,
    fontWeight: "800",
  },
});
