/**
 * Job history — past and completed jobs. Tap a card for full details.
 */
import { useCallback, useEffect, useState } from "react";
import { View, Pressable, RefreshControl, ScrollView, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  Screen,
  CrewText,
  EmptyState,
  PrimaryButton,
} from "@/app/components/ui/system";
import { HistoryCard } from "@/app/components/ui/job/HistoryCard";
import { useThemeTokens } from "@/hooks/useThemeTokens";
import { useAppointment } from "@/app/app-hooks/useAppointment";
import {
  useGetJobHistoryQuery,
  useLazyGetJobHistoryQuery,
} from "@/app/store/api/appointmentsApi";
import type { JobCardProps } from "@/app/interfaces/AppointmentInterface";

const PAGE_SIZE = 30;

export default function JobHistoryScreen() {
  const { colors, spacing } = useThemeTokens();
  const { handleJobPress } = useAppointment();
  const [jobs, setJobs] = useState<JobCardProps[]>([]);
  const [hasMore, setHasMore] = useState(false);

  const { data, isLoading, isFetching, refetch } = useGetJobHistoryQuery({
    limit: PAGE_SIZE,
    offset: 0,
  });
  const [fetchMore, { isFetching: isLoadingMore }] = useLazyGetJobHistoryQuery();

  useEffect(() => {
    if (!data) return;
    setJobs(data.jobs);
    setHasMore(Boolean(data.has_more));
  }, [data]);

  const onRefresh = useCallback(async () => {
    const result = await refetch();
    if (result.data) {
      setJobs(result.data.jobs);
      setHasMore(Boolean(result.data.has_more));
    }
  }, [refetch]);

  const onLoadMore = useCallback(async () => {
    if (!hasMore || isLoadingMore) return;
    const result = await fetchMore({
      limit: PAGE_SIZE,
      offset: jobs.length,
    }).unwrap();
    setJobs((prev) => {
      const seen = new Set(prev.map((job) => String(job.id)));
      return [
        ...prev,
        ...result.jobs.filter((job) => !seen.has(String(job.id))),
      ];
    });
    setHasMore(Boolean(result.has_more));
  }, [fetchMore, hasMore, isLoadingMore, jobs.length]);

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
            refreshing={Boolean(isFetching && jobs.length > 0)}
            onRefresh={onRefresh}
            tintColor={colors.button}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            accessibilityLabel="Back"
            style={({ pressed }) => [
              styles.back,
              {
                borderColor: colors.borders,
                backgroundColor: colors.cards,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <CrewText variant="title">Job history</CrewText>
            <CrewText variant="caption" muted>
              Completed and cancelled jobs only.
            </CrewText>
          </View>
        </View>

        {isLoading && jobs.length === 0 ? (
          <CrewText variant="body" muted>
            Loading…
          </CrewText>
        ) : jobs.length === 0 ? (
          <EmptyState
            icon="time-outline"
            title="No past jobs yet"
            body="Completed and cancelled jobs will show up here."
          />
        ) : (
          <View style={{ gap: spacing.xs }}>
            {jobs.map((job) => (
              <HistoryCard
                key={String(job.id)}
                date={job.appointment_date}
                time={job.appointment_time}
                serviceName={job.service_type}
                status={job.status}
                onPress={() => handleJobPress(String(job.id))}
              />
            ))}
            {hasMore ? (
              <PrimaryButton
                label="Load more"
                variant="ghost"
                loading={isLoadingMore}
                onPress={onLoadMore}
              />
            ) : null}
          </View>
        )}
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
  back: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
