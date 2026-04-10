import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { JobCardProps } from "@/app/interfaces/AppointmentInterface";
import StyledText from "../../helpers/StyledText";
import { useThemeColor } from "@/hooks/useThemeColor";
import LinearGradientComponent from "../../helpers/LinearGradientComponent";

/**
 * JobCard Component
 *
 * Displays job information in a card format with client details,
 * service information, and status indicator. The card height can be
 * adjusted based on the duration of the job to span multiple time slots.
 *
 * Props:
 *
 * - job: Job data object
 * - onPress: Optional callback function when card is pressed
 * - slotsToOccupy: Number of time slots this job should visually occupy
 */
interface JobCardComponentProps {
  job: JobCardProps;
  onPress?: (id: string | number) => void;
  slotsToOccupy?: number;
}

const JobCard: React.FC<JobCardComponentProps> = ({
  job,
  onPress,
  slotsToOccupy = 1,
}) => {
  const CardComponent = onPress ? TouchableOpacity : View;

  /* import the color */
  const cardColor = useThemeColor({}, "cards");
  const borderColor = useThemeColor({}, "borders");
  const textColor = useThemeColor({}, "text");

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "pending":
        return { color: "#856404" };
      case "accepted":
        return { color: "#0C5460" };
      case "in_progress":
        return { color: "#155724" };
      case "completed":
        return { color: "#155724" };
      case "cancelled":
        return { color: "#721C24" };
      default:
        return { color: "#856404" };
    }
  };

  // Calculate height based on number of slots to occupy
  const cardHeight = slotsToOccupy * 80; // 80px per slot (adjust as needed)

  return (
    <LinearGradientComponent
      color1={cardColor}
      color2={textColor}
      start={{ x: 0, y: 0 }}
      end={{ x: 3, y: 1 }}
      style={[
        styles.jobCard,
        {
          backgroundColor: cardColor,
          borderColor,
          minHeight: cardHeight,
        },
      ]}
    >
      <CardComponent onPress={() => onPress?.(job.id)}>
        <View style={styles.jobCardHeader}>
          <StyledText variant="titleMedium">{job.client_name}</StyledText>
          <StyledText variant="bodyMedium">{job.service_type}</StyledText>
        </View>
        <View style={styles.jobCardDetails}>
          <StyledText variant="bodyMedium">{job.appointment_time}</StyledText>
          <StyledText variant="bodyMedium">{job.duration} min</StyledText>
        </View>
        <View style={styles.jobStatus}>
          <StyledText variant="labelMedium" style={getStatusStyle(job.status)}>
            {job.status}
          </StyledText>
        </View>
      </CardComponent>
    </LinearGradientComponent>
  );
};

const styles = StyleSheet.create({
  jobCard: {
    backgroundColor: "#fff",
    borderRadius: 5,
    padding: 10,
    borderWidth: 2,
    justifyContent: "center", // Center content vertically when height is increased
  },
  jobCardHeader: {
    marginBottom: 8,
  },
  jobCardDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  jobStatus: {
    alignSelf: "flex-start",
  },
});

export default JobCard;
