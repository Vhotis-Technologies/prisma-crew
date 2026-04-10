import React from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { useThemeColor } from "../../../../hooks/useThemeColor";
import StyledText from "../../helpers/StyledText";
import { formatCurrency, formatDate } from "@/app/utils/converters";
import { EarningItemProps } from "@/app/interfaces/EarningInterface";

const RecentEarningItem = ({
  earning,
  onPress,
}: {
  earning: EarningItemProps;
  onPress?: () => void;
}) => {
  const textColor = useThemeColor({}, "text");
  const primaryColor = useThemeColor({}, "button");

  return (
    <TouchableOpacity
      style={styles.earningItem}
      activeOpacity={0.7}
      onPress={onPress}
    >
      <View style={styles.earningHeader}>
        <View style={styles.earningInfo}>
          <StyledText variant="bodySmall" style={{ opacity: 0.7 }}>
            {earning.job_reference || "N/A"}
          </StyledText>
          <StyledText variant="bodyMedium">
            {earning.client_name || "Unknown Client"}
          </StyledText>
          <StyledText
            variant="bodySmall"
            style={{ color: textColor, opacity: 0.7 }}
          >
            {earning.service_type || "Service"}
          </StyledText>
        </View>
        <View style={styles.earningAmount}>
          <StyledText
            variant="titleMedium"
            style={{ color: primaryColor, fontWeight: "500" }}
          >
            {formatCurrency(earning.total_earned || 0)}
          </StyledText>
        </View>
      </View>

      <View style={styles.earningFooter}>
        <View style={styles.earningMeta}>
          {earning.hourly_earnings && earning.hourly_earnings > 0 && (
            <StyledText
              variant="bodySmall"
              style={{ color: textColor, opacity: 0.7 }}
            >
              {formatCurrency(earning.hourly_earnings)} hourly
            </StyledText>
          )}
          {earning.total_active_hours && earning.total_active_hours > 0 && (
            <StyledText
              variant="bodySmall"
              style={{ color: textColor, opacity: 0.7 }}
            >
              ({earning.total_active_hours.toFixed(1)}h active, {earning.total_inactive_hours?.toFixed(1) || '0.0'}h inactive)
            </StyledText>
          )}
          {earning.completed_date && (
            <StyledText
              variant="bodySmall"
              style={{ color: textColor, opacity: 0.7 }}
            >
              {formatDate(earning.completed_date)}
            </StyledText>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  earningItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  earningHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  earningInfo: {
    flex: 1,
    marginRight: 12,
  },
  earningAmount: {
    alignItems: "flex-end",
  },
  earningFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  earningMeta: {
    flexDirection: "row",
    gap: 12,
  },
});

export default RecentEarningItem;
