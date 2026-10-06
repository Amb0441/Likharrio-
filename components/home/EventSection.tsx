import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import COLORS from "../../constants/Colors";
import { EventData } from "../../lib/types";
import { formatEventDate } from "../../lib/helpers";
import LoadingIndicator from "../ui/LoadingIndicator";
import EmptyState from "../ui/EmptyState";
import { isEventPast } from "../../lib/helpers";

interface EventSectionProps {
  events: EventData[];
  loading: boolean;
  onViewAll: () => void;
  onPressEvent: (id: string) => void;
}

export default function EventSection({
  events,
  loading,
  onViewAll,
  onPressEvent,
}: EventSectionProps) {
  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.title}>Events Board</Text>
        <TouchableOpacity onPress={onViewAll}>
          <Text style={styles.viewAll}>View All</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        {loading ? (
          <LoadingIndicator />
        ) : events.length === 0 ? (
          <EmptyState icon="calendar-outline" title="No upcoming events" />
        ) : (
          <View style={styles.list}>
            {events.map((event) => (
              <TouchableOpacity
                key={event.id}
                style={styles.row}
                onPress={() => onPressEvent(event.id)}
              >
                <View style={styles.dateBox}>
                  <Text style={styles.dateLabel}>
                    {formatEventDate(event.eventDate).split(" ")[0]}
                  </Text>
                  <Text style={styles.dateNum}>
                    {formatEventDate(event.eventDate).split(" ")[1]}
                  </Text>
                </View>
                <View style={styles.info}>
                  <Text style={styles.eventTitle} numberOfLines={1}>
                    {event.title}
                  </Text>
                  <Text style={styles.eventSub} numberOfLines={1}>
                    {event.location}
                  </Text>
                </View>
                {isEventPast(event.eventDate) && (
                  <View style={styles.pastBadge}>
                    <Text style={styles.pastBadgeText}>Past Due</Text>
                  </View>
                )}
                <Ionicons
                  name="chevron-forward"
                  size={14}
                  color={COLORS.text.muted}
                />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: 20,
    marginTop: 24,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  title: {
    fontSize: 17,
    fontWeight: "800",
    color: COLORS.text.primary,
    lineHeight: 22,
  },
  viewAll: {
    fontSize: 13,
    color: COLORS.primary.deepRed,
    fontWeight: "600",
    lineHeight: 22,
  },
  card: {
    backgroundColor: COLORS.text.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: COLORS.border.primary,
  },
  list: {
    gap: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  dateBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.ui.iconBackground,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  dateLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: COLORS.primary.deepRed,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  dateNum: {
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.primary.deepRed,
    lineHeight: 18,
  },
  info: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.text.primary,
    marginBottom: 2,
  },
  eventSub: {
    fontSize: 12,
    color: COLORS.text.muted,
  },
  pastBadge: {
    backgroundColor: "#EDE0D4",
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  pastBadgeText: {
    color: "#6B5946",
    fontSize: 10,
    fontWeight: "700",
  },
});
