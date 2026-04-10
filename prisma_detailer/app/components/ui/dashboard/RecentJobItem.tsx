import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import React from 'react'
import { RecentJobProps } from '@/app/interfaces/DashboardInterface'
import StyledText from '../../helpers/StyledText';
import { formatCurrency, formatDate} from '@/app/utils/converters';
import { useThemeColor } from '@/hooks/useThemeColor';

const RecentJobItem = ({job}: {job: RecentJobProps}) => {
    const textColor = useThemeColor({}, "text");
    const primaryColor = useThemeColor({}, "primary");

  return (
    <TouchableOpacity
      key={job.id}
      style={styles.activityItem}
    >
      <View style={styles.itemHeader}>
        <StyledText
          variant="bodyMedium"
          style={{ color: textColor, fontWeight: "500" }}
        >
          {job.clientName}
        </StyledText>
        <StyledText
          variant="bodySmall"
          style={{ color: textColor, opacity: 0.7 }}
        >
          {formatDate(job.completedAt)}
        </StyledText>
      </View>
      <StyledText
        variant="bodySmall"
        style={{ color: textColor, opacity: 0.8 }}
      >
        {job.serviceType}
      </StyledText>
      <View style={styles.itemFooter}>
        <StyledText
          variant="bodySmall"
          style={{ color: primaryColor, fontWeight: "500" }}
        >
          {formatCurrency(job.earnings)}
        </StyledText>
        {job.rating && (
          <View style={styles.ratingContainer}>
            <StyledText variant="labelSmall" style={{ color: textColor }}>
              ⭐ {job.rating}
            </StyledText>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default RecentJobItem

const styles = StyleSheet.create({
  activityItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  itemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  itemFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  ratingContainer: {
    backgroundColor: "rgba(255, 193, 7, 0.1)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
});