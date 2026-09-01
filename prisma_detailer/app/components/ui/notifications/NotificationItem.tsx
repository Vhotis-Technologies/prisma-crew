/**
 * Notification row — swipe to delete.
 */
import { useRef } from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import {
  Notification,
  NotificationType,
} from "@/app/interfaces/NotificationInterface";
import { useAlertContext } from "@/app/contexts/AlertContext";
import { useThemeTokens } from "@/hooks/useThemeTokens";
import { CrewText } from "@/app/components/ui/system";

type NotificationItemProps = {
  notification: Notification;
  onPress: (notification: Notification) => void;
  onDelete: (notificationId: string) => void;
};

function iconFor(type: NotificationType): keyof typeof Ionicons.glyphMap {
  switch (type) {
    case NotificationType.BOOKING_CANCELLED:
      return "close-circle";
    case NotificationType.BOOKING_CONFIRMED:
    case NotificationType.BOOKING_CREATED:
      return "checkmark-circle";
    case NotificationType.APPOINTMENT_STARTED:
      return "play-circle";
    case NotificationType.CLEANING_COMPLETED:
    case NotificationType.CAR_READY:
      return "sparkles";
    case NotificationType.CREW_CHAT:
      return "chatbubble-ellipses";
    default:
      return "notifications";
  }
}

function timeAgo(timestamp: Date): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

export const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onPress,
  onDelete,
}) => {
  const { colors, radius, spacing } = useThemeTokens();
  const { setAlertConfig, setIsVisible } = useAlertContext();
  const swipeableRef = useRef<Swipeable>(null);

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={() => (
        <Pressable
          onPress={() =>
            setAlertConfig({
              isVisible: true,
              title: "Delete this alert?",
              message: "This cannot be undone.",
              type: "warning",
              onClose: () => setIsVisible(false),
              onConfirm: () => {
                onDelete(notification.id);
                swipeableRef.current?.close();
              },
            })
          }
          style={[
            styles.delete,
            { backgroundColor: colors.error, borderRadius: radius.md },
          ]}
        >
          <Ionicons name="trash-outline" size={20} color={colors.buttonText} />
        </Pressable>
      )}
    >
      <Pressable
        onPress={() => onPress(notification)}
        style={[
          styles.row,
          {
            backgroundColor: colors.cards,
            borderColor: notification.isRead ? colors.borders : colors.primary,
            borderRadius: radius.md,
            padding: spacing.md,
            gap: spacing.sm,
          },
        ]}
      >
        <Ionicons
          name={iconFor(notification.type)}
          size={22}
          color={notification.isRead ? colors.muted : colors.primary}
        />
        <View style={{ flex: 1, gap: 2 }}>
          <CrewText variant="subtitle" numberOfLines={1}>
            {notification.title}
          </CrewText>
          <CrewText variant="caption" muted numberOfLines={2}>
            {notification.message}
          </CrewText>
          <CrewText variant="caption" muted>
            {timeAgo(notification.timestamp)}
          </CrewText>
        </View>
      </Pressable>
    </Swipeable>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
  },
  delete: {
    width: 64,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
});
