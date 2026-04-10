import React from "react";
import { View, StyleSheet } from "react-native";
import { useThemeColor } from "@/hooks/useThemeColor";
import StyledText from "@/app/components/helpers/StyledText";
import { QuickStatsProps, StatCardProps } from "@/app/interfaces/DashboardInterface";
import { formatCurrency } from "@/app/utils/converters";
  
interface QuickStatsCardProps {
  data: QuickStatsProps | undefined;
}

const QuickStatsCard = ( { data }: QuickStatsCardProps ) => {
  const cardColor = useThemeColor({}, "cards");
  const backgroundColor = useThemeColor({}, "background");
  const textColor = useThemeColor({}, "text");
  const borderColor = useThemeColor({}, "borders");

  const stats: StatCardProps[] = [
    {
      title: "Weekly Earnings",
      value: formatCurrency(data?.weeklyEarnings || 0),
      icon: "💰",
      color: "primary",
    },
    {
      title: "Monthly Earnings",
      value: formatCurrency(data?.monthlyEarnings || 0),
      icon: "📊",
      color: "success",
    },
    {
      title: "Jobs This Week",
      value: data?.completedJobsThisWeek || 0,
      icon: "✅",
      color: "info",
    },
    {
      title: "Pending Jobs",
      value: data?.pendingJobsCount || 0,
      icon: "⏳",
      color: "warning",
    },
    {
      title: "Average Rating",
      value: `${data?.averageRating?.toFixed(1) || 0} ⭐`,
      subtitle: `${data?.totalReviews || 0} reviews`,
      icon: "⭐",
      color: "success",
    },
    {
      title: "Jobs This Month",
      value: data?.completedJobsThisMonth || 0,
      icon: "📈",
      color: "primary",
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: cardColor, borderColor }]}>
      <View style={styles.header}>
        <StyledText variant="titleMedium" style={{ color: textColor }}>
          Quick Stats
        </StyledText>
        <StyledText
          variant="bodySmall"
          style={{ color: textColor, opacity: 0.7 }}
        >
          This week
        </StyledText>
      </View>

      <View style={styles.statsGrid}>
        {stats.map((stat, index) => (
          <View
            key={index}
            style={[styles.statCard, { backgroundColor, borderColor }]}
          >
            <View style={styles.statHeader}>
              <StyledText
                variant="labelSmall"
              >
                {stat.icon}
              </StyledText>
            </View>
            <View style={styles.statContent}>
              <StyledText variant="titleMedium" style={{ color: textColor }}>
                {stat.value}
              </StyledText>
              <StyledText
                variant="bodySmall"
                style={{ color: textColor, opacity: 0.7 }}
              >
                {stat.title}
              </StyledText>
              {stat.subtitle && (
                <StyledText
                  variant="labelSmall"
                  style={{ color: textColor, opacity: 0.5 }}
                >
                  {stat.subtitle}
                </StyledText>
              )}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  header: {
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  statCard: {
    flexDirection: "row",
    gap: 10,
    width: "48%",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  statHeader: {
    marginBottom: 8,
  },
  statContent: {
    alignItems: "flex-start",
  },
});

export default QuickStatsCard;
