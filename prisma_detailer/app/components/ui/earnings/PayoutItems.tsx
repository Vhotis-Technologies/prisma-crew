import React from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { useThemeColor } from "../../../../hooks/useThemeColor";
import StyledText from "../../../components/helpers/StyledText";
import { formatCurrency, formatDate } from "@/app/utils/converters";
import { PayoutItemProps } from "@/app/interfaces/EarningInterface";

interface PayoutCardItemProps {
  payout: PayoutItemProps;
  onPress?: (payoutId: string) => void;
}

const PayoutCardItem = ({ payout, onPress }: PayoutCardItemProps) => {
  const textColor = useThemeColor({}, "text");

  /**
   * Get status color and icon
   */
  const getStatusInfo = (status: string) => {
    switch (status) {
      case "completed":
        return { color: "#4CAF50", icon: "✅", label: "Completed" };
      case "processing":
        return { color: "#2196F3", icon: "🔄", label: "Processing" };
      case "pending":
        return { color: "#FF9800", icon: "⏳", label: "Pending" };
      case "failed":
        return { color: "#F44336", icon: "❌", label: "Failed" };
      default:
        return { color: "#9E9E9E", icon: "❓", label: "Unknown" };
    }
  };

  /**
   * Get bank account display name
   */
  const getBankDisplayName = (bankAccount: any) => {
    try {
      if (!bankAccount || typeof bankAccount !== "object") {
        return "Unknown Bank Account";
      }

      if (!bankAccount.account_number || !bankAccount.bank_name) {
        return "Incomplete Bank Info";
      }

      const lastFour = bankAccount.account_number.toString().slice(-4);
      return `${bankAccount.bank_name} •••• ${lastFour}`;
    } catch (error) {
      console.error("Error in getBankDisplayName:", error);
      return "Bank Account Error";
    }
  };

  const statusInfo = getStatusInfo(payout.status || "unknown");

  return (
    <TouchableOpacity
      style={styles.payoutItem}
      onPress={() => {
        try {
          if (onPress && payout.id) {
            onPress(payout.id);
          }
        } catch (error) {
          console.error("Error in onPayoutPress:", error);
        }
      }}
      activeOpacity={0.7}
    >
      <View style={styles.payoutHeader}>
        <View style={styles.payoutInfo}>
          <StyledText
            variant="bodyMedium"
            style={{ color: textColor, fontWeight: "500" }}
          >
            {formatCurrency(payout.amount || 0)}
          </StyledText>
          <StyledText
            variant="bodySmall"
            style={{ color: textColor, opacity: 0.7 }}
          >
            {payout.earnings_count || 0} earnings •{" "}
            {payout.payout_date ? formatDate(payout.payout_date) : "No date"}
          </StyledText>
        </View>
        <View
          style={[styles.statusBadge, { backgroundColor: statusInfo.color }]}
        >
          <StyledText variant="labelSmall" style={{ color: "white" }}>
            {statusInfo.icon} {statusInfo.label}
          </StyledText>
        </View>
      </View>

      <View style={styles.payoutDetails}>
        <View style={styles.bankInfo}>
          <StyledText
            variant="bodySmall"
            style={{ color: textColor, opacity: 0.8 }}
          >
            🏦{" "}
            {payout.bank_account
              ? getBankDisplayName(payout.bank_account)
              : "No bank account"}
          </StyledText>
          <StyledText
            variant="bodySmall"
            style={{ color: textColor, opacity: 0.7 }}
          >
            {payout.bank_account?.account_name || "Unknown account"}
          </StyledText>
        </View>

        {payout.transaction_id && (
          <View style={styles.transactionInfo}>
            <StyledText
              variant="bodySmall"
              style={{ color: textColor, opacity: 0.7 }}
            >
              Transaction ID: {payout.transaction_id}
            </StyledText>
          </View>
        )}

        <View style={styles.periodInfo}>
          <StyledText
            variant="bodySmall"
            style={{ color: textColor, opacity: 0.7 }}
          >
            Period:{" "}
            {payout.period_start
              ? formatDate(payout.period_start)
              : "No start date"}{" "}
            -{" "}
            {payout.period_end ? formatDate(payout.period_end) : "No end date"}
          </StyledText>
        </View>

        {payout.notes && (
          <View style={styles.notesSection}>
            <StyledText
              variant="bodySmall"
              style={{ color: textColor, opacity: 0.7 }}
            >
              📝 {payout.notes}
            </StyledText>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  payoutItem: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  payoutHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  payoutInfo: {
    flex: 1,
    marginRight: 12,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  payoutDetails: {
    gap: 8,
  },
  bankInfo: {
    gap: 2,
  },
  transactionInfo: {
    backgroundColor: "rgba(0,0,0,0.02)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  periodInfo: {
    marginTop: 4,
  },
  notesSection: {
    backgroundColor: "rgba(255, 193, 7, 0.1)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 4,
  },
});

export default PayoutCardItem;
