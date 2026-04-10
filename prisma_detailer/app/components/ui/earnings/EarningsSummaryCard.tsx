import React from "react";
import { View, StyleSheet } from "react-native";
import { useThemeColor } from "../../../../hooks/useThemeColor";
import StyledText from "../../../components/helpers/StyledText";
import { formatCurrency, formatDate } from "@/app/utils/converters";
import { EarningsSummaryCardProps } from "@/app/interfaces/EarningInterface";

const EarningsSummaryCard: React.FC<EarningsSummaryCardProps> = ({
  total_earned,
  total_jobs,
  average_per_job,
  percentage_change,
  is_positive_change,
  pending_payouts,
  next_payout_date,
  bank_accounts_count,
}) => {
  const backgroundColor = useThemeColor({}, "cards");
  const textColor = useThemeColor({}, "text");
  const borderColor = useThemeColor({}, "borders");

  /**
   * Format percentage change with appropriate sign and color
   */
  const formatPercentageChange = (percentage: number, isPositive: boolean) => {
    const sign = isPositive ? "+" : "";
    return `${sign}${percentage.toFixed(1)}%`;
  };

  /**
   * Get color for percentage change indicator
   */
  const getChangeColor = (isPositive: boolean) => {
    return isPositive ? "#4CAF50" : "#F44336";
  };

  return (
    <View style={[styles.container, { backgroundColor, borderColor }]}>
      {/* Header */}
      <View style={styles.header}>
        <StyledText variant="titleMedium" style={{ color: textColor }}>
          Earnings Summary
        </StyledText>
        <StyledText
          variant="bodySmall"
          style={{ color: textColor, opacity: 0.7 }}
        >
          Current Period
        </StyledText>
      </View>

      {/* Main Earnings Display */}
      <View style={styles.mainEarnings}>
        <StyledText variant="headlineLarge" style={{ color: textColor }}>
          {formatCurrency(total_earned)}
        </StyledText>
        <View style={styles.changeIndicator}>
          <StyledText
            variant="bodyMedium"
            style={{
              color: getChangeColor(is_positive_change),
              fontWeight: "500",
            }}
          >
            {formatPercentageChange(percentage_change, is_positive_change)}
          </StyledText>
          <StyledText
            variant="bodySmall"
            style={{ color: textColor, opacity: 0.7 }}
          >
            vs previous period
          </StyledText>
        </View>
      </View>

      {/* Detailed Stats Grid */}
      <View style={styles.statsGrid}>
        <View style={styles.statItem}>
          <StyledText variant="titleLarge" style={{ color: textColor }}>
            {total_jobs}
          </StyledText>
          <StyledText
            variant="bodySmall"
            style={{ color: textColor, opacity: 0.7 }}
          >
            Jobs
          </StyledText>
        </View>
        <View style={styles.statItem}>
          <StyledText variant="titleLarge" style={{ color: textColor }}>
            {formatCurrency(average_per_job)}
          </StyledText>
          <StyledText
            variant="bodySmall"
            style={{ color: textColor, opacity: 0.7 }}
          >
            Avg/Job
          </StyledText>
        </View>
      </View>

      {/* Pending Payouts */}
      {pending_payouts > 0 && (
        <View style={styles.pendingSection}>
          <View style={styles.pendingHeader}>
            <StyledText variant="titleSmall" style={{ color: textColor }}>
              Pending Payouts
            </StyledText>
            <View style={styles.pendingBadge}>
              <StyledText variant="labelSmall" style={{ color: "white" }}>
                {pending_payouts}
              </StyledText>
            </View>
          </View>
          {next_payout_date && (
            <StyledText
              variant="bodySmall"
              style={{ color: textColor, opacity: 0.7 }}
            >
              Next payout: {new Date(next_payout_date).toLocaleDateString()}
            </StyledText>
          )}
        </View>
      )}

      {/* Bank Accounts Summary */}
      {bank_accounts_count > 0 && (
        <View style={styles.bankSection}>
          <StyledText variant="titleSmall" style={{ color: textColor }}>
            Bank Accounts
          </StyledText>
          <StyledText
            variant="bodySmall"
            style={{ color: textColor, opacity: 0.7 }}
          >
            {bank_accounts_count} account
            {bank_accounts_count !== 1 ? "s" : ""} connected
          </StyledText>
        </View>
      )}
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
    marginBottom: 16,
  },
  mainEarnings: {
    alignItems: "center",
    marginBottom: 24,
  },
  changeIndicator: {
    alignItems: "center",
    marginTop: 8,
  },
  statsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  statItem: {
    alignItems: "center",
    flex: 1,
  },
  pendingSection: {
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.1)",
    paddingTop: 16,
    marginBottom: 16,
  },
  pendingHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  pendingBadge: {
    backgroundColor: "#FF9800",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  bankSection: {
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.1)",
    paddingTop: 16,
  },
});

export default EarningsSummaryCard;
