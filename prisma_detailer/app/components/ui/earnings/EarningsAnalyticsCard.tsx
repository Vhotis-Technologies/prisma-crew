import React from "react";
import { View, StyleSheet } from "react-native";
import { useThemeColor } from "../../../../hooks/useThemeColor";
import StyledText from "../../../components/helpers/StyledText";
import { formatCurrency } from "@/app/utils/converters";
import { EarningsAnalyticsProps } from "@/app/interfaces/EarningInterface";

const EarningsAnalyticsCard: React.FC<EarningsAnalyticsProps> = ({
  total_lifetime_earnings,
  average_weekly_earnings,
  average_monthly_earnings,
  total_jobs_completed,
  best_earning_day,
  best_earning_month,
  earnings_trend,
  trend_percentage,
}) => {
  const backgroundColor = useThemeColor({}, "cards");
  const textColor = useThemeColor({}, "text");
  const borderColor = useThemeColor({}, "borders");
  /**
   * Get trend icon and color based on earnings trend
   */
  const getTrendInfo = (trend: string) => {
    switch (trend) {
      case "increasing":
        return { icon: "📈", color: "#4CAF50" };
      case "decreasing":
        return { icon: "📉", color: "#F44336" };
      default:
        return { icon: "➡️", color: "#FF9800" };
    }
  };

  const trendInfo = getTrendInfo(earnings_trend);

  return (
    <View style={[styles.container, { backgroundColor, borderColor }]}>
      {/* Header */}
      <View style={styles.header}>
        <StyledText variant="titleMedium" style={{ color: textColor }}>
          Analytics Overview
        </StyledText>
        <StyledText
          variant="bodySmall"
          style={{ color: textColor, opacity: 0.7 }}
        >
          Lifetime Performance
        </StyledText>
      </View>

      {/* Main Stats Grid */}
      <View style={styles.mainStatsGrid}>
        <View style={styles.mainStatItem}>
          <StyledText variant="headlineSmall" style={{ color: textColor }}>
            {formatCurrency(total_lifetime_earnings)}
          </StyledText>
          <StyledText
            variant="bodySmall"
            style={{ color: textColor, opacity: 0.7 }}
          >
            Total Earnings
          </StyledText>
        </View>
        <View style={styles.mainStatItem}>
          <StyledText variant="headlineSmall" style={{ color: textColor }}>
            {total_jobs_completed}
          </StyledText>
          <StyledText
            variant="bodySmall"
            style={{ color: textColor, opacity: 0.7 }}
          >
            Jobs Completed
          </StyledText>
        </View>
      </View>

      {/* Trend Indicator */}
      <View style={styles.trendSection}>
        <View style={styles.trendHeader}>
          <StyledText variant="titleSmall" style={{ color: textColor }}>
            Earnings Trend
          </StyledText>
          <View style={styles.trendIndicator}>
            <StyledText variant="titleLarge" style={{ color: trendInfo.color }}>
              {trendInfo.icon}
            </StyledText>
          </View>
        </View>
        <StyledText
          variant="bodyMedium"
          style={{
            color: trendInfo.color,
            fontWeight: "500",
            marginBottom: 4,
          }}
        >
          {trend_percentage > 0 ? "+" : ""}
          {trend_percentage.toFixed(1)}% this period
        </StyledText>
        <StyledText
          variant="bodySmall"
          style={{ color: textColor, opacity: 0.7 }}
        >
          Compared to previous period
        </StyledText>
      </View>

      {/* Detailed Analytics Grid */}
      <View style={styles.analyticsGrid}>
        <View style={styles.analyticsItem}>
          <StyledText variant="titleMedium" style={{ color: textColor }}>
            {formatCurrency(average_weekly_earnings)}
          </StyledText>
          <StyledText
            variant="bodySmall"
            style={{ color: textColor, opacity: 0.7 }}
          >
            Avg Weekly
          </StyledText>
        </View>
        <View style={styles.analyticsItem}>
          <StyledText variant="titleMedium" style={{ color: textColor }}>
            {formatCurrency(average_monthly_earnings)}
          </StyledText>
          <StyledText
            variant="bodySmall"
            style={{ color: textColor, opacity: 0.7 }}
          >
            Avg Monthly
          </StyledText>
        </View>
      </View>

      {/* Best Performance */}
      <View style={styles.performanceSection}>
        <StyledText
          variant="titleSmall"
          style={{ color: textColor, marginBottom: 12 }}
        >
          Best Performance
        </StyledText>
        <View style={styles.performanceGrid}>
          <View style={styles.performanceItem}>
            <StyledText
              variant="bodyMedium"
              style={{ color: textColor, fontWeight: "500" }}
            >
              {best_earning_day}
            </StyledText>
            <StyledText
              variant="bodySmall"
              style={{ color: textColor, opacity: 0.7 }}
            >
              Best Day
            </StyledText>
          </View>
          <View style={styles.performanceItem}>
            <StyledText
              variant="bodyMedium"
              style={{ color: textColor, fontWeight: "500" }}
            >
              {best_earning_month}
            </StyledText>
            <StyledText
              variant="bodySmall"
              style={{ color: textColor, opacity: 0.7 }}
            >
              Best Month
            </StyledText>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  header: {
    marginBottom: 20,
  },
  mainStatsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  mainStatItem: {
    alignItems: "center",
    flex: 1,
  },
  trendSection: {
    backgroundColor: "rgba(0,0,0,0.02)",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  trendHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  trendIndicator: {
    alignItems: "center",
  },
  analyticsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  analyticsItem: {
    width: "48%",
    alignItems: "center",
    marginBottom: 16,
  },
  performanceSection: {
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.1)",
    paddingTop: 16,
  },
  performanceGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  performanceItem: {
    alignItems: "center",
    flex: 1,
  },
});

export default EarningsAnalyticsCard;
