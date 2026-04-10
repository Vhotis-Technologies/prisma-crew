import React, { useState } from "react";
import { View, StyleSheet, ScrollView, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeColor } from "@/hooks/useThemeColor";
import StyledText from "@/app/components/helpers/StyledText";
import TodayOverviewCard from "@/app/components/ui/dashboard/TodayOverviewCard";
import QuickStatsCard from "@/app/components/ui/dashboard/QuickStatsCard";
import RecentActivityCard from "@/app/components/ui/dashboard/RecentActivityCard";
import { useDashboard } from "@/app/app-hooks/useDashboard";
import { useAppointment } from "@/app/app-hooks/useAppointment";
import ModalServices from "@/app/services/ModalServices";
import RecentJobList from "@/app/components/ui/dashboard/RecentJobList";
import { useAppSelector } from "@/app/store/my_store";

const DashboardScreen = () => {
  const insets = useSafeAreaInsets();
  const user = useAppSelector((state: any) => state.auth.user);
  const backgroundColor = useThemeColor({}, "background");
  const textColor = useThemeColor({}, "text");
  const cardColor = useThemeColor({}, "cards");
  const borderColor = useThemeColor({}, "borders");

  const [viewAllJobs, setViewAllJobs] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date().toISOString());
  const {
    handleQuickActions,
    viewNextAppointment,
    callClient,
    quickStats,
    recentJobs,
    refetchAllData,
    todayOverview,
  } = useDashboard();

  // Use existing handleJobPress from useAppointment for navigation
  const { handleJobPress } = useAppointment();

  const displayName = user?.first_name ? user.first_name : "there";

  return (
    <View style={[styles.root, { backgroundColor }]}>
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await refetchAllData();
              setLastUpdated(new Date().toISOString());
              setRefreshing(false);
            }}
            tintColor={textColor}
          />
        }
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 50 },
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <StyledText variant="titleMedium" style={{ color: textColor }}>
            Welcome back
          </StyledText>
          <StyledText variant="bodySmall" style={{ color: textColor, opacity: 0.7 }}>
            Last updated: {new Date(lastUpdated).toLocaleTimeString()}
          </StyledText>
        </View>

        {/* Today's Overview */}
        {todayOverview && (
          <View style={styles.section}>
            <TodayOverviewCard
              data={todayOverview}
              onViewNextAppointment={viewNextAppointment}
              onStartCurrentJob={handleJobPress}
              onCompleteCurrentJob={handleJobPress}
              onCallClient={callClient}
            />
          </View>
        )}

        {/* Quick Stats */}
        <View style={styles.section}>
          <QuickStatsCard data={quickStats} />
        </View>

        {/* Recent Activity */}
        <View style={styles.section}>
          <RecentActivityCard
            data={recentJobs}
            onViewAllJobs={() =>
              recentJobs && recentJobs.length > 0 && setViewAllJobs(!viewAllJobs)
            }
          />
        </View>
      </ScrollView>

      <ModalServices
        visible={viewAllJobs}
        onClose={() => setViewAllJobs(false)}
        component={<RecentJobList jobs={recentJobs || []} />}
        title="Recent Jobs"
        showCloseButton={true}
        animationType="slide"
        modalType="sheet"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
  },
  header: {
    paddingBottom: 16,
  },
  greeting: {
    fontWeight: "700",
    marginBottom: 4,
  },
  section: {
    marginBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  bottomSpacing: {
    paddingBottom: 70,
  },
});

export default DashboardScreen;
