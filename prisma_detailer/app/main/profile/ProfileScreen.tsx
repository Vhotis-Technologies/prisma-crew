import React, { useState } from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  Image,
  Switch,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppSelector } from "@/app/store/my_store";
import StyledText from "@/app/components/helpers/StyledText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import useProfile from "@/app/app-hooks/useProfile";
import { formatCurrency } from "@/app/utils/converters";
import { useAlertContext } from "@/app/contexts/AlertContext";
import { useThemeContext } from "@/app/contexts/ThemeProvider";

const HEADER_PURPLE = "#6B4E9E";
const CARD_RADIUS = 10;
const AVATAR_SIZE = 88;

type TrackerTab = "Bookings" | "Average Rating" | "Earnings";

const ProfileScreen = () => {
  const user = useAppSelector((state: any) => state.auth.user);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { profileStatistics, handleActions } = useProfile();
  const { setAlertConfig, setIsVisible } = useAlertContext();
  const { currentTheme, setTheme } = useThemeContext();

  const [trackerTab, setTrackerTab] = useState<TrackerTab>("Earnings");
  const isDarkMode = currentTheme === "dark";

  const backgroundColor = useThemeColor({}, "background");
  const textColor = useThemeColor({}, "text");
  const cardColor = useThemeColor({}, "cards");
  const borderColor = useThemeColor({}, "borders");
  const primaryColor = useThemeColor({}, "primary");
  const successColor = useThemeColor({}, "success");
  const subtextColor = useThemeColor({}, "text");

  const displayName =
    [user?.first_name, user?.last_name].filter(Boolean).join(" ") || "User";
  const joinedYear = (user as any)?.created_at
    ? new Date((user as any).created_at).getFullYear()
    : null;

  const joinedLabel = joinedYear ? `Joined since ${joinedYear}` : "Crew Member";

  const handleEditProfile = () => {
    setAlertConfig({
      title: "Edit Profile",
      message: "Profile editing functionality will be implemented soon.",
      type: "warning",
      isVisible: true,
      onConfirm: () => setIsVisible(false),
    });
  };

  const handleDarkModeToggle = (value: boolean) => {
    setTheme(value ? "dark" : "light");
  };

  const renderListItem = (
    icon: keyof typeof Ionicons.glyphMap,
    title: string,
    onPress: () => void,
  ) => (
    <TouchableOpacity
      key={title}
      style={[styles.listItem, { borderBottomColor: borderColor }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.listItemLeft}>
        <Ionicons name={icon} size={22} color={primaryColor} />
        <StyledText
          variant="bodyLarge"
          style={[styles.listItemTitle, { color: textColor }]}
        >
          {title}
        </StyledText>
      </View>
      <Ionicons name="chevron-forward" size={20} color={subtextColor} />
    </TouchableOpacity>
  );

  const trackerValue =
    trackerTab === "Bookings"
      ? String(profileStatistics?.total_bookings ?? 0)
      : trackerTab === "Average Rating"
        ? `${profileStatistics?.avg_rating ?? 0}/5`
        : formatCurrency(profileStatistics?.total_earnings ?? 0);
  const performanceText = "+12% better than last month";

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile block: avatar centered on top, then name and Edit Profile */}
        <View style={styles.profileBlock}>
          <View style={styles.avatarWrap}>
            {user?.image ? (
              <Image source={{ uri: user.image }} style={styles.avatar} />
            ) : (
              <View
                style={[
                  styles.avatarPlaceholder,
                  { backgroundColor: HEADER_PURPLE },
                ]}
              >
                <StyledText variant="headlineMedium" style={styles.avatarText}>
                  {user?.first_name?.charAt(0) ?? "U"}
                  {user?.last_name?.charAt(0) ?? ""}
                </StyledText>
              </View>
            )}
          </View>
          <View style={styles.nameRow}>
            <View style={styles.nameCol}>
              <StyledText variant="headlineMedium" style={{ color: textColor }}>
                {displayName}
              </StyledText>
              <StyledText
                variant="bodySmall"
                style={[styles.joinedText, { color: subtextColor }]}
              >
                {joinedLabel}
              </StyledText>
            </View>
            <TouchableOpacity
              style={[styles.editProfileBtn, { backgroundColor: borderColor }]}
              onPress={handleEditProfile}
            >
              <StyledText variant="labelMedium" style={{ color: textColor }}>
                Edit Profile
              </StyledText>
            </TouchableOpacity>
          </View>
        </View>

        {/* Monthly Tracker card (no graph) */}
        <View
          style={[
            styles.trackerCard,
            {
              backgroundColor: cardColor,
              borderColor,
              width: width - 32,
            },
          ]}
        >
          <StyledText
            variant="titleMedium"
            style={[styles.trackerTitle, { color: textColor }]}
          >
            My Tracker
          </StyledText>
          <View style={styles.trackerTabs}>
            {(["Bookings", "Average Rating", "Earnings"] as TrackerTab[]).map(
              (tab) => (
                <TouchableOpacity
                  key={tab}
                  style={[
                    styles.tab,
                    trackerTab === tab && {
                      backgroundColor: borderColor,
                      borderRadius: 8,
                    },
                  ]}
                  onPress={() => setTrackerTab(tab)}
                >
                  <StyledText
                    variant="labelMedium"
                    style={{
                      color: textColor,
                      opacity: trackerTab === tab ? 1 : 0.7,
                    }}
                  >
                    {tab}
                  </StyledText>
                </TouchableOpacity>
              ),
            )}
          </View>
          <View style={styles.trackerValueRow}>
            <View>
              <StyledText variant="headlineSmall" style={{ color: textColor }}>
                {trackerValue}
              </StyledText>
            </View>
          </View>
        </View>

        {/* Settings list */}
        <View
          style={[
            styles.listCard,
            {
              backgroundColor: cardColor,
              borderColor,
              width: width - 32,
            },
          ]}
        >
          {renderListItem("card-outline", "Payment Methods", () =>
            handleActions("bankAccount"),
          )}
          {renderListItem(
            "shield-checkmark-outline",
            "My Availability",
            () => handleActions("availability")
          )}
          {renderListItem("time-outline", "Transaction History", () =>
            handleActions("earnings")
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    backgroundColor: HEADER_PURPLE,
    paddingHorizontal: 12,
    paddingBottom: 52,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerBackButton: {
    backgroundColor: "rgba(255,255,255,0.3)",
    borderRadius: 22,
    padding: 10,
  },
  headerBackPlaceholder: {
    width: 42,
    height: 42,
  },
  headerSpacer: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    alignItems: "center",
  },
  profileBlock: {
    alignItems: "center",
    marginBottom: 20,
  },
  avatarWrap: {
    marginBottom: 16,
    alignSelf: "center",
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
  },
  avatarPlaceholder: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#fff",
    fontWeight: "bold",
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    paddingHorizontal: 0,
  },
  nameCol: {
    flex: 1,
  },
  joinedText: {
    marginTop: 2,
    opacity: 0.8,
  },
  editProfileBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  trackerCard: {
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    padding: 16,
    marginBottom: 20,
  },
  trackerTitle: {
    marginBottom: 12,
  },
  trackerTabs: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  trackerValueRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  performanceText: {
    marginTop: 4,
  },
  listCard: {
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    overflow: "hidden",
  },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  darkModeRow: {
    borderBottomWidth: 0,
  },
  listItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  listItemTitle: {
    fontWeight: "500",
  },
});

export default ProfileScreen;
