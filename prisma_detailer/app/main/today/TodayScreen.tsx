/**
 * Today — current/next job hero and the rest of the day's run sheet.
 */
import { useEffect, useMemo } from "react";
import {
  View,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Linking,
} from "react-native";
import dayjs from "dayjs";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Screen, JobRow, PrimaryButton, CrewText, EmptyState } from "@/app/components/ui/system";
import { useThemeTokens } from "@/hooks/useThemeTokens";
import { useDashboard } from "@/app/app-hooks/useDashboard";
import { useAppointment } from "@/app/app-hooks/useAppointment";
import { useNotification } from "@/app/app-hooks/useNotification";
import { useAppSelector } from "@/app/store/my_store";
import { CrewRoutes } from "../crewRoutes";
import type { JobCardProps } from "@/app/interfaces/AppointmentInterface";

function openMaps(address: string) {
  const q = encodeURIComponent(address);
  Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${q}`);
}

export default function TodayScreen() {
  const { colors, spacing, radius } = useThemeTokens();
  const user = useAppSelector((state) => state.auth.user);
  const { unreadCount } = useNotification();
  const {
    todayOverview,
    isLoadingTodayOverview,
    refetchAllData,
    callClient,
  } = useDashboard();
  const {
    allAppointments,
    isLoadingAllAppointments,
    setSelectedDay,
    handleJobPress,
    refetchAllAppointments,
  } = useAppointment();

  useEffect(() => {
    setSelectedDay(dayjs());
  }, [setSelectedDay]);

  const jobs: JobCardProps[] = Array.isArray(allAppointments)
    ? [...allAppointments].sort((a, b) =>
        a.appointment_time.localeCompare(b.appointment_time),
      )
    : [];

  const hero = todayOverview.currentJob || todayOverview.nextAppointment;
  const heroIsCurrent = Boolean(todayOverview.currentJob);
  const remaining = useMemo(() => {
    if (!hero) return jobs;
    return jobs.filter((job) => String(job.id) !== String(hero.id));
  }, [jobs, hero]);

  const name = user?.first_name || "there";
  const jobCount = todayOverview.totalAppointments || jobs.length;
  const refreshing = isLoadingTodayOverview || isLoadingAllAppointments;

  const heroTime =
    todayOverview.currentJob?.startTime ||
    todayOverview.nextAppointment?.appointmentTime ||
    "";
  const heroService =
    todayOverview.currentJob?.serviceType ||
    todayOverview.nextAppointment?.serviceType ||
    "Job";
  const heroClient =
    todayOverview.currentJob?.clientName ||
    todayOverview.nextAppointment?.clientName ||
    "";
  const heroAddress =
    (heroIsCurrent
      ? todayOverview.currentJob?.address
      : todayOverview.nextAppointment?.address) ||
    jobs.find((job) => String(job.id) === String(hero?.id))?.address ||
    "";
  const heroPhone = todayOverview.currentJob?.clientPhone || "";
  const heroVehicle =
    todayOverview.currentJob?.vehicleInfo ||
    todayOverview.nextAppointment?.vehicleInfo ||
    "";

  return (
    <Screen padded={false} edges={["top"]}>
      <ScrollView
        contentContainerStyle={{
          padding: spacing.md,
          paddingBottom: spacing.xxl,
          gap: spacing.md,
        }}
        refreshControl={
          <RefreshControl
            refreshing={Boolean(refreshing)}
            onRefresh={() => {
              refetchAllData();
              refetchAllAppointments();
            }}
            tintColor={colors.button}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <CrewText variant="caption" muted>
              Today · {jobCount} job{jobCount === 1 ? "" : "s"}
            </CrewText>
            <CrewText variant="title">Hi {name}</CrewText>
          </View>
          <Pressable
            onPress={() => router.push(CrewRoutes.notifications)}
            accessibilityLabel="Notifications"
            style={[
              styles.iconBtn,
              { borderColor: colors.borders, backgroundColor: colors.cards },
            ]}
          >
            <Ionicons name="notifications-outline" size={22} color={colors.text} />
            {unreadCount > 0 ? (
              <View style={[styles.badge, { backgroundColor: colors.error }]}>
                <CrewText variant="caption" color={colors.buttonText}>
                  {unreadCount > 99 ? "99+" : unreadCount}
                </CrewText>
              </View>
            ) : null}
          </Pressable>
        </View>

        {hero ? (
          <View
            style={[
              styles.hero,
              {
                backgroundColor: colors.cards,
                borderColor: colors.primary,
                borderRadius: radius.md,
                padding: spacing.lg,
                gap: spacing.sm,
              },
            ]}
          >
            <CrewText variant="caption" color={colors.primary}>
              {heroIsCurrent ? "Current job" : "Next up"}
            </CrewText>
            <CrewText variant="display">{heroTime}</CrewText>
            <CrewText variant="subtitle">{heroService}</CrewText>
            <CrewText variant="body" muted>
              {heroClient}
              {heroVehicle ? ` · ${heroVehicle}` : ""}
            </CrewText>
            {heroAddress ? (
              <CrewText variant="caption" muted>
                {heroAddress}
              </CrewText>
            ) : null}

            <View style={{ gap: spacing.xs, marginTop: spacing.sm }}>
              <PrimaryButton
                label="Open job"
                onPress={() => handleJobPress(String(hero.id))}
              />
              <View style={{ flexDirection: "row", gap: spacing.xs }}>
                {heroAddress ? (
                  <PrimaryButton
                    label="Navigate"
                    variant="secondary"
                    fullWidth={false}
                    onPress={() => openMaps(heroAddress)}
                  />
                ) : null}
                {heroPhone ? (
                  <PrimaryButton
                    label="Call"
                    variant="secondary"
                    fullWidth={false}
                    onPress={() => callClient(heroPhone)}
                  />
                ) : null}
              </View>
            </View>
          </View>
        ) : (
          <View
            style={[
              styles.hero,
              {
                backgroundColor: colors.cards,
                borderColor: colors.borders,
                borderRadius: radius.md,
                padding: spacing.xl,
              },
            ]}
          >
            <EmptyState
              icon="sunny-outline"
              title="No jobs assigned today"
              body="When you are given work, it will show up here."
            />
          </View>
        )}

        {remaining.length > 0 ? (
          <View style={{ gap: spacing.xs }}>
            <CrewText variant="label" muted>
              Rest of the day
            </CrewText>
            {remaining.map((job) => (
              <JobRow
                key={String(job.id)}
                time={job.appointment_time}
                serviceName={job.service_type}
                clientName={job.client_name}
                status={job.status}
                durationMin={job.duration}
                location={job.address}
                isCurrent={job.status === "in_progress"}
                onPress={() => handleJobPress(String(job.id))}
              />
            ))}
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  hero: {
    borderWidth: 2,
  },
});
