/**
 * Notifications — job alerts. No payout copy.
 */
import { useState } from "react";
import { View, Pressable, FlatList, RefreshControl, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useNotification } from "@/app/app-hooks/useNotification";
import { NotificationItem } from "@/app/components/ui/notifications/NotificationItem";
import { Notification } from "@/app/interfaces/NotificationInterface";
import { useAlertContext } from "@/app/contexts/AlertContext";
import { Screen, CrewText, EmptyState } from "@/app/components/ui/system";
import { useThemeTokens } from "@/hooks/useThemeTokens";
import { CrewRoutes } from "../crewRoutes";
import { NotificationType } from "@/app/interfaces/NotificationInterface";

export default function NotificationScreen() {
  const { colors, spacing } = useThemeTokens();
  const { setAlertConfig, setIsVisible } = useAlertContext();
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refreshNotifications,
  } = useNotification();
  const [refreshing, setRefreshing] = useState(false);

  const openNotification = (notification: Notification) => {
    if (!notification.isRead) markAsRead(notification.id);
    if (notification.type === NotificationType.CREW_CHAT) {
      router.push(CrewRoutes.supportChat);
      return;
    }
    setAlertConfig({
      isVisible: true,
      title: notification.title,
      message: notification.message,
      type: "success",
      onConfirm: () => {},
    });
  };

  return (
    <Screen padded={false} edges={["top"]}>
      <View
        style={[
          styles.header,
          { paddingHorizontal: spacing.md, paddingTop: spacing.md },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          accessibilityLabel="Back"
          style={[
            styles.back,
            { borderColor: colors.borders, backgroundColor: colors.cards },
          ]}
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <CrewText variant="title">Notifications</CrewText>
          {unreadCount > 0 ? (
            <CrewText variant="caption" muted>
              {unreadCount} unread
            </CrewText>
          ) : null}
        </View>
        {unreadCount > 0 ? (
          <Pressable
            onPress={() =>
              setAlertConfig({
                isVisible: true,
                title: "Mark all as read?",
                message: "Unread alerts will be marked read.",
                type: "warning",
                onClose: () => setIsVisible(false),
                onConfirm: markAllAsRead,
              })
            }
          >
            <CrewText variant="label" color={colors.primary}>
              Mark all read
            </CrewText>
          </Pressable>
        ) : null}
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <NotificationItem
            notification={item}
            onPress={openNotification}
            onDelete={deleteNotification}
          />
        )}
        contentContainerStyle={{
          padding: spacing.md,
          paddingBottom: spacing.xxl,
          gap: spacing.xs,
          flexGrow: 1,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              refreshNotifications();
              setTimeout(() => setRefreshing(false), 800);
            }}
            tintColor={colors.button}
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon="notifications-off-outline"
            title="No notifications"
            body="Job alerts will show up here."
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingBottom: 12,
  },
  back: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
