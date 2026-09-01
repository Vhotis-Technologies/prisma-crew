/**
 * Me — ratings, unavailable, settings. No earnings.
 */
import { View, Pressable, ScrollView, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen, CrewText, PrimaryButton } from "@/app/components/ui/system";
import { useThemeTokens } from "@/hooks/useThemeTokens";
import useProfile from "@/app/app-hooks/useProfile";
import { useAuthContext } from "@/app/contexts/AuthContextProvider";
import { CrewRoutes } from "../crewRoutes";

function stars(rating: number) {
  const rounded = Math.round(rating);
  return "★".repeat(Math.max(0, Math.min(5, rounded))) +
    "☆".repeat(Math.max(0, 5 - Math.max(0, Math.min(5, rounded))));
}

export default function MeScreen() {
  const { colors, spacing, radius } = useThemeTokens();
  const { userProfile, profileStatistics } = useProfile();
  const { handleLogout } = useAuthContext();

  const name = [userProfile?.first_name, userProfile?.last_name]
    .filter(Boolean)
    .join(" ") || "Crew member";
  const avg = Number(profileStatistics?.avg_rating || 0);
  const reviews = profileStatistics?.reviews || [];
  const jobs = profileStatistics?.total_bookings || 0;

  return (
    <Screen padded={false} edges={["top"]}>
      <ScrollView
        contentContainerStyle={{
          padding: spacing.md,
          paddingBottom: spacing.xxl,
          gap: spacing.md,
        }}
        showsVerticalScrollIndicator={false}
      >
        <CrewText variant="title">Me</CrewText>

        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.cards,
              borderColor: colors.borders,
              borderRadius: radius.md,
              padding: spacing.lg,
              gap: spacing.xs,
            },
          ]}
        >
          <CrewText variant="subtitle">{name}</CrewText>
          <CrewText variant="body" muted>
            {userProfile?.email}
          </CrewText>
          <CrewText variant="display">
            {avg > 0 ? avg.toFixed(1) : "—"}
          </CrewText>
          <CrewText variant="caption" muted>
            {avg > 0 ? stars(avg) : "Ratings appear after customers review jobs"}
            {reviews.length ? ` · ${reviews.length} review${reviews.length === 1 ? "" : "s"}` : ""}
          </CrewText>
          <CrewText variant="caption" muted>
            {jobs} job{jobs === 1 ? "" : "s"} completed
          </CrewText>
        </View>

        <View style={{ gap: spacing.xs }}>
          <LinkRow
            icon="close-circle-outline"
            label="Unavailable"
            hint="Block hours so you are not given new jobs"
            onPress={() => router.push(CrewRoutes.unavailable)}
          />
          <LinkRow
            icon="time-outline"
            label="Job history"
            hint="Past jobs and completed work"
            onPress={() => router.push(CrewRoutes.history)}
          />
          <LinkRow
            icon="notifications-outline"
            label="Notifications"
            onPress={() => router.push(CrewRoutes.notifications)}
          />
          <LinkRow
            icon="settings-outline"
            label="Settings"
            onPress={() => router.push(CrewRoutes.settings)}
          />
        </View>

        {reviews.length > 0 ? (
          <View style={{ gap: spacing.xs }}>
            <CrewText variant="label" muted>
              Recent reviews
            </CrewText>
            {reviews.slice(0, 8).map((review) => (
              <View
                key={String(review.id)}
                style={[
                  styles.card,
                  {
                    backgroundColor: colors.cards,
                    borderColor: colors.borders,
                    borderRadius: radius.md,
                    padding: spacing.md,
                    gap: 4,
                  },
                ]}
              >
                <CrewText variant="caption" color={colors.warning}>
                  {stars(Number(review.rating || 0))}
                </CrewText>
                {review.comment ? (
                  <CrewText variant="body">{review.comment}</CrewText>
                ) : null}
                <CrewText variant="caption" muted>
                  {review.created_by}
                  {review.created_at
                    ? ` · ${new Date(review.created_at).toLocaleDateString()}`
                    : ""}
                </CrewText>
              </View>
            ))}
          </View>
        ) : null}

        <PrimaryButton label="Sign out" variant="ghost" onPress={handleLogout} />
      </ScrollView>
    </Screen>
  );
}

function LinkRow({
  icon,
  label,
  hint,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  hint?: string;
  onPress: () => void;
}) {
  const { colors, radius, spacing } = useThemeTokens();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          flexDirection: "row" as const,
          alignItems: "center" as const,
          gap: spacing.sm,
          backgroundColor: colors.cards,
          borderColor: colors.borders,
          borderWidth: 1,
          borderRadius: radius.md,
          padding: spacing.md,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <Ionicons name={icon} size={22} color={colors.button} />
      <View style={{ flex: 1 }}>
        <CrewText variant="subtitle">{label}</CrewText>
        {hint ? (
          <CrewText variant="caption" muted>
            {hint}
          </CrewText>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
  },
});
