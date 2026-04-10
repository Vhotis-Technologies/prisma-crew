import React, { useState } from "react";
import { View, StyleSheet, TouchableOpacity, Pressable } from "react-native";
import { useThemeColor } from "@/hooks/useThemeColor";
import { TodayOverviewProps } from "@/app/interfaces/DashboardInterface";
import StyledText from "@/app/components/helpers/StyledText";
import StyledButton from "@/app/components/helpers/StyledButton";
import NoOverviewCard from "./NoOverviewCard";
import { formatTime } from "@/app/utils/converters";
import { MaterialIcons } from "@expo/vector-icons";

interface TodayOverviewCardProps {
  data: TodayOverviewProps;
  onViewNextAppointment?: () => void;
  onStartCurrentJob?: (jobId: string) => void;
  onCompleteCurrentJob?: (jobId: string) => void;
  onCallClient?: (phoneNumber: string) => void;
}

const TodayOverviewCard: React.FC<TodayOverviewCardProps> = ({
  data,
  onViewNextAppointment,
  onStartCurrentJob,
  onCompleteCurrentJob,
  onCallClient,
}) => {
  const backgroundColor = useThemeColor({}, "cards");
  const textColor = useThemeColor({}, "text");
  const borderColor = useThemeColor({}, "borders");
  const primaryColor = useThemeColor({}, "primary");
  const iconColor = useThemeColor({}, "icons");
  
  // State to toggle between current job and next appointment when both exist
  // MUST be called before any conditional returns to follow Rules of Hooks
  const [showNextAppointment, setShowNextAppointment] = useState(false);

  // Check if data is null or if there are no appointments today
  if (
    !data ||
    data.totalAppointments === null ||
    data.totalAppointments === 0
  ) {
    return <NoOverviewCard />;
  }

  // Determine what to show
  const hasBoth = data.currentJob && data.nextAppointment;
  const showCurrentJob = data.currentJob && (!hasBoth || !showNextAppointment);
  const showNextAppt =
    data.nextAppointment && (!hasBoth || showNextAppointment);

  return (
    <View style={[styles.container, { backgroundColor, borderColor }]}>
      <View style={styles.header}>
        <StyledText variant="titleMedium" style={{ color: textColor }}>
          Today's Overview
        </StyledText>
        <StyledText
          variant="bodySmall"
          style={{ color: textColor, opacity: 0.7 }}
        >
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </StyledText>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <StyledText variant="headlineSmall" style={{ color: textColor }}>
            {data.totalAppointments}
          </StyledText>
          <StyledText
            variant="bodySmall"
            style={{ color: textColor, opacity: 0.7 }}
          >
            Total Jobs
          </StyledText>
        </View>
        <View style={styles.statItem}>
          <StyledText variant="headlineSmall" style={{ color: textColor }}>
            {data.completedJobs}
          </StyledText>
          <StyledText
            variant="bodySmall"
            style={{ color: textColor, opacity: 0.7 }}
          >
            Completed
          </StyledText>
        </View>
        <View style={styles.statItem}>
          <StyledText variant="headlineSmall" style={{ color: textColor }}>
            {data.pendingJobs}
          </StyledText>
          <StyledText
            variant="bodySmall"
            style={{ color: textColor, opacity: 0.7 }}
          >
            Pending
          </StyledText>
        </View>
      </View>

      {/* Toggle buttons when both current job and next appointment exist */}
      {hasBoth && (
        <View style={styles.toggleContainer}>
          <TouchableOpacity
            style={[
              styles.toggleButton,
              !showNextAppointment && { backgroundColor: primaryColor },
            ]}
            onPress={() => setShowNextAppointment(false)}
          >
            <StyledText
              variant="labelSmall"
              style={{
                color: !showNextAppointment ? "white" : textColor,
                fontWeight: !showNextAppointment ? "600" : "400",
              }}
            >
              Current Job
            </StyledText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.toggleButton,
              showNextAppointment && { backgroundColor: primaryColor },
            ]}
            onPress={() => setShowNextAppointment(true)}
          >
            <StyledText
              variant="labelSmall"
              style={{
                color: showNextAppointment ? "white" : textColor,
                fontWeight: showNextAppointment ? "600" : "400",
              }}
            >
              Next Appointment
            </StyledText>
          </TouchableOpacity>
        </View>
      )}
      {/* Show the data for the current job */}
      {showCurrentJob && (
        <View style={styles.currentJobSection}>
          <View style={styles.sectionHeader}>
            <StyledText variant="titleSmall" style={{ color: textColor }}>
              Current Job
            </StyledText>
            <View style={styles.statusBadge}>
              <StyledText variant="labelSmall" style={{ color: "white" }}>
                {data.currentJob!.status.replace("_", " ").toUpperCase()}
              </StyledText>
            </View>
          </View>
          <View style={styles.innerRow}>
            <StyledText variant="labelMedium" style={{ opacity: 0.5 }}>
              Client Name:
            </StyledText>
            <StyledText variant="bodyMedium" style={{ color: textColor }}>
              {data.currentJob!.clientName.toLocaleLowerCase()}
            </StyledText>
          </View>
          <View style={styles.innerRow}>
            <StyledText variant="labelMedium" style={{ opacity: 0.5 }}>
              Service Type:
            </StyledText>
            <StyledText variant="bodyMedium" style={{ color: textColor }}>
              {data.currentJob!.serviceType.toLocaleLowerCase()}
            </StyledText>
          </View>
          {data.currentJob!.vehicleInfo && (
            <View style={styles.innerRow}>
              <StyledText variant="labelMedium" style={{ opacity: 0.5 }}>
                Vehicle Info:
              </StyledText>
              <StyledText variant="bodyMedium" style={{ color: textColor }}>
                {data.currentJob!.vehicleInfo.toLocaleUpperCase()}
              </StyledText>
            </View>
          )}

          {data.currentJob!.valetType && (
            <View style={styles.innerRow}>
              <StyledText variant="labelMedium" style={{ opacity: 0.5 }}>
                Valet Type:
              </StyledText>
              <StyledText variant="labelSmall">
                {data
                  .currentJob!.valetType.replace("_", " ")
                  .toLocaleLowerCase()}
              </StyledText>
            </View>
          )}
          {data.currentJob!.addons && (
            <View style={styles.innerRow}>
              <StyledText variant="labelMedium" style={{ opacity: 0.5 }}>
                Addons:
              </StyledText>
              <StyledText variant="labelSmall">
                {data.currentJob!.addons.join(", ").toLocaleLowerCase()}
              </StyledText>
            </View>
          )}
          {data.currentJob!.specialInstruction && (
            <View style={styles.innerRow}>
              <StyledText variant="labelMedium" style={{ opacity: 0.5 }}>
                Special Instruction:
              </StyledText>
              <StyledText variant="labelSmall">
                {data.currentJob!.specialInstruction}
              </StyledText>
            </View>
          )}
          {data.currentJob!.loyalty_tier && (
            <View style={styles.innerRow}>
              <StyledText variant="labelMedium" style={{ opacity: 0.5 }}>
                Loyalty Tier:
              </StyledText>
              <StyledText variant="labelSmall">
                {data.currentJob!.loyalty_tier.charAt(0).toUpperCase() +
                  data.currentJob!.loyalty_tier.slice(1)}
              </StyledText>
            </View>
          )}
          {data.currentJob!.loyalty_benefits &&
            data.currentJob!.loyalty_benefits.length > 0 && (
              <View style={styles.innerRow}>
                <StyledText variant="labelMedium" style={{ opacity: 0.5 }}>
                  Loyalty Benefits:
                </StyledText>
                <StyledText variant="labelSmall">
                  {data.currentJob!.loyalty_benefits.join(", ")}
                </StyledText>
              </View>
            )}
          <StyledText
            variant="bodySmall"
            style={{ color: textColor, opacity: 0.7 }}
          >
            Started at {formatTime(data.currentJob!.startTime)}
          </StyledText>

          <View style={styles.actionButtonContainer}>
            {/* Show Start Job button only when status is 'accepted' */}
            {data.currentJob!.status === "accepted" && (
              <StyledButton
                variant="small"
                onPress={() =>
                  onStartCurrentJob && onStartCurrentJob(data.currentJob!.id)
                }
                style={styles.actionButton}
              >
                Start Job
              </StyledButton>
            )}

            {/* Show Continue Job button when status is 'in_progress' */}
            {data.currentJob!.status === "in_progress" && (
              <StyledButton
                variant="small"
                onPress={() =>
                  onCompleteCurrentJob &&
                  onCompleteCurrentJob(data.currentJob!.id)
                }
                style={styles.actionButton}
              >
                Complete Job
              </StyledButton>
            )}
          </View>

          {/* Call Client button - show when phone number is available */}
          {data.currentJob!.clientPhone && onCallClient && (
            <View style={styles.callButtonContainer}>
              <TouchableOpacity
                style={[styles.callButton, { borderColor: primaryColor }]}
                onPress={() => onCallClient(data.currentJob!.clientPhone!)}
              >
                <MaterialIcons name="phone" size={20} color={iconColor}/>
                <StyledText
                  variant="labelMedium"
                  style={{ marginLeft: 8 }}
                >
                  Call Client
                </StyledText>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* Show the data for the next appointment */}
      {showNextAppt && (
        <View style={styles.nextAppointmentSection}>
          <View style={styles.sectionHeader}>
            <StyledText variant="titleSmall" style={{ color: textColor }}>
              Next Appointment
            </StyledText>
            <StyledText
              variant="labelSmall"
              style={{ color: textColor, opacity: 0.7 }}
            >
              {formatTime(data.nextAppointment!.appointmentTime)}
            </StyledText>
          </View>
          <View style={styles.innerRow}>
            <StyledText variant="labelMedium" style={{ opacity: 0.5 }}>
              Client Name:
            </StyledText>
            <StyledText variant="bodyMedium" style={{ color: textColor }}>
              {data.nextAppointment!.clientName.toLocaleLowerCase()}
            </StyledText>
          </View>
          <View style={styles.innerRow}>
            <StyledText variant="labelMedium" style={{ opacity: 0.5 }}>
              Service Type:
            </StyledText>
            <StyledText variant="bodyMedium" style={{ color: textColor }}>
              {data.nextAppointment!.serviceType.toLocaleLowerCase()}
            </StyledText>
          </View>
          <View style={styles.innerRow}>
            <StyledText variant="labelMedium" style={{ opacity: 0.5 }}>
              Duration:
            </StyledText>
            <StyledText variant="bodyMedium" style={{ color: textColor }}>
              {data.nextAppointment!.duration}
            </StyledText>
          </View>
          <View style={styles.innerRow}>
            <StyledText variant="labelMedium" style={{ opacity: 0.5 }}>
              Vehicle Info:
            </StyledText>
            <StyledText variant="bodyMedium" style={{ color: textColor }}>
              {data.nextAppointment!.vehicleInfo.toLocaleUpperCase()}
            </StyledText>
          </View>
          {data.nextAppointment!.valetType && (
            <View style={styles.innerRow}>
              <StyledText variant="labelMedium" style={{ opacity: 0.5 }}>
                Valet Type:
              </StyledText>
              <StyledText variant="labelSmall">
                {data
                  .nextAppointment!.valetType.replace("_", " ")
                  .toLocaleLowerCase()}
              </StyledText>
            </View>
          )}
          {data.nextAppointment!.addons && (
            <View style={styles.innerRow}>
              <StyledText variant="labelMedium" style={{ opacity: 0.5 }}>
                Addons:
              </StyledText>
              <StyledText variant="labelSmall">
                {data.nextAppointment!.addons.join(", ")}
              </StyledText>
            </View>
          )}
          {data.nextAppointment!.specialInstruction && (
            <View style={styles.innerRow}>
              <StyledText variant="labelMedium" style={{ opacity: 0.5 }}>
                Special Instruction:
              </StyledText>
              <StyledText variant="labelSmall">
                {data.nextAppointment!.specialInstruction}
              </StyledText>
            </View>
          )}
          {data.nextAppointment!.loyalty_tier && (
            <View style={styles.innerRow}>
              <StyledText variant="labelMedium" style={{ opacity: 0.5 }}>
                Loyalty Tier:
              </StyledText>
              <StyledText variant="labelSmall">
                {data.nextAppointment!.loyalty_tier.charAt(0).toUpperCase() +
                  data.nextAppointment!.loyalty_tier.slice(1)}
              </StyledText>
            </View>
          )}
          {data.nextAppointment!.loyalty_benefits &&
            data.nextAppointment!.loyalty_benefits.length > 0 && (
              <View style={styles.innerRow}>
                <StyledText variant="labelMedium" style={{ opacity: 0.5 }}>
                  Loyalty Benefits:
                </StyledText>
                <StyledText variant="labelSmall">
                  {data.nextAppointment!.loyalty_benefits.join(", ")}
                </StyledText>
              </View>
            )}
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  header: {
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  statItem: {
    alignItems: "center",
    flex: 1,
  },
  toggleContainer: {
    flexDirection: "row",
    marginBottom: 16,
    backgroundColor: "rgba(0,0,0,0.05)",
    borderRadius: 8,
    padding: 4,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: "center",
  },
  currentJobSection: {
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.1)",
    paddingTop: 16,
  },
  nextAppointmentSection: {
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.1)",
    paddingTop: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  actionButtonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
  },
  statusBadge: {
    backgroundColor: "#4CAF50",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  actionButton: {
    alignSelf: "flex-start",
    marginTop: 12,
  },
  innerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  callButtonContainer: {
    position: "absolute",
    marginTop: 10,
    alignItems: "flex-start",
    bottom: 0,
    right: 0,
  },
  callButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 5,
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: 20,
    backgroundColor: "transparent",
  },
});

export default TodayOverviewCard;
