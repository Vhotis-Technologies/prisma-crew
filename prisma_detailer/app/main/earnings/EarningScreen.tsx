import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeColor } from "@/hooks/useThemeColor";
import StyledText from "@/app/components/helpers/StyledText";
import EarningsSummaryCard from "@/app/components/ui/earnings/EarningsSummaryCard";
import EarningsAnalyticsCard from "@/app/components/ui/earnings/EarningsAnalyticsCard";
import RecentEarningCard from "@/app/components/ui/earnings/RecentEarningCard";
import PayoutHistoryCard from "@/app/components/ui/earnings/PayoutHistoryCard";
import ModalServices from "@/app/services/ModalServices";
import RecentEarnings from "@/app/components/ui/earnings/RecentEarnings";
import PaymentHistory from "@/app/components/ui/earnings/PaymentHistory";
import { useEarnings } from "@/app/app-hooks/useEarnings";

const SECTION_SPACING = 20;

const EarningScreen = () => {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const {
    earningsSummary,
    recentEarnings,
    earningsAnalytics,
    payoutHistory,
    isAllDataLoading,
    handleRefetchData,
  } = useEarnings();

  const [showAllEarnings, setShowAllEarnings] = useState(false);
  const [showAllPayouts, setShowAllPayouts] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date().toISOString());
  const [refreshing, setRefreshing] = useState(false);

  const backgroundColor = useThemeColor({}, "background");
  const textColor = useThemeColor({}, "text");

  const handleRefresh = async () => {
    setRefreshing(true);
    await handleRefetchData();
    setLastUpdated(new Date().toISOString());
    setRefreshing(false);
  };

  if (isAllDataLoading) {
    return (
      <View
        style={[
          styles.loadingRoot,
          { backgroundColor, paddingTop: insets.top },
        ]}
      >
        <ActivityIndicator size="large" color={textColor} />
      </View>
    );
  }

  const contentWidth = width - 32;

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + 8,
            paddingBottom: insets.bottom + 24,
            paddingHorizontal: 16,
          },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={textColor}
          />
        }
      >
        {/* Page header */}
        <View style={styles.header}>
          <StyledText variant="headlineMedium" style={[styles.title, { color: textColor }]}>
            Earnings
          </StyledText>
          <StyledText
            variant="bodySmall"
            style={[styles.lastUpdated, { color: textColor }]}
          >
            Last updated: {new Date(lastUpdated).toLocaleTimeString()}
          </StyledText>
        </View>

        {/* Earnings Summary */}
        {earningsSummary && (
          <View style={[styles.cardWrap, { width: contentWidth }]}>
            <EarningsSummaryCard {...earningsSummary} />
          </View>
        )}

        {/* Analytics Overview */}
        {earningsAnalytics && (
          <View style={[styles.cardWrap, { width: contentWidth }]}>
            <EarningsAnalyticsCard {...earningsAnalytics} />
          </View>
        )}

        {/* Section: Recent Earnings */}
        <View style={[styles.sectionHeader, { width: contentWidth }]}>
          <StyledText variant="titleSmall" style={{ color: textColor, opacity: 0.8 }}>
            Recent activity
          </StyledText>
        </View>
        <View style={[styles.cardWrap, { width: contentWidth }]}>
          <RecentEarningCard
            earnings={recentEarnings?.slice(0, 3) || []}
            onViewAllPress={() => setShowAllEarnings(true)}
          />
        </View>

        {/* Section: Payout History */}
        <View style={[{ width: contentWidth, paddingBottom: 50 }]}>
          <PayoutHistoryCard
            payments={payoutHistory?.slice(0, 2) || []}
            onViewAllPress={() => setShowAllPayouts(true)}
          />
        </View>
      </ScrollView>

      <ModalServices
        visible={showAllEarnings}
        onClose={() => setShowAllEarnings(false)}
        component={<RecentEarnings earnings={recentEarnings || []} />}
        title="All Earnings"
        modalType="fullscreen"
        animationType="fade"
        showCloseButton={true}
      />

      <ModalServices
        visible={showAllPayouts}
        onClose={() => setShowAllPayouts(false)}
        component={<PaymentHistory payments={payoutHistory || []} />}
        title="All Payouts"
        modalType="sheet"
        animationType="fade"
        showCloseButton={true}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingRoot: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    alignItems: "center",
  },
  header: {
    width: "100%",
    marginBottom: SECTION_SPACING,
  },
  title: {
    fontWeight: "700",
    marginBottom: 4,
  },
  lastUpdated: {
    opacity: 0.7,
  },
  cardWrap: {
    marginBottom: SECTION_SPACING,
  },
  sectionHeader: {
    marginBottom: 10,
    paddingHorizontal: 4,
  },
});

export default EarningScreen;
