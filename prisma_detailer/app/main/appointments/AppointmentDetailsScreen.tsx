import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  RefreshControl,
} from "react-native";
import React, { useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useThemeColor } from "@/hooks/useThemeColor";
import StyledText from "@/app/components/helpers/StyledText";
import { Ionicons } from "@expo/vector-icons";
import StyledButton from "@/app/components/helpers/StyledButton";
import { JobDetailsProps } from "@/app/interfaces/AppointmentInterface";
import { useAppointment } from "@/app/app-hooks/useAppointment";
import { useGetAppointmentDetailsQuery } from "@/app/store/api/appointmentsApi";
import {
  captureMultipleCameraImages,
  prepareImagesForUpload,
  type ImageAlertHelpers,
} from "@/app/utils/images";
import { FleetMaintenanceProps } from "@/app/interfaces/AppointmentInterface";
import StyledTextInput from "@/app/components/helpers/StyledTextInput";
import { useAlertContext } from "@/app/contexts/AlertContext";

/**
 * AppointmentDetailsScreen Component
 *
 * Displays detailed information about a specific appointment: client, vehicle,
 * location, service, schedule, and status. Pay is strictly per hour; no
 * job-level payment amounts are shown.
 *
 * Features:
 * - Client and vehicle information
 * - Service details and schedule (time, duration)
 * - Status indicator and action buttons (accept, start, complete, etc.)
 */

const AppointmentDetailsScreen = () => {
  const {
    isLoadingAppointmentDetails,
    handleCompleteAppointment,
    handleStartAppointment,
    handleUploadBeforeImages,
    handleUploadAfterImages,
    handleSubmitFleetMaintenance,
    isLoadingUploadBeforeImages,
    isLoadingUploadAfterImages,
    isLoadingSubmitFleetMaintenance,
  } = useAppointment();
  const router = useRouter();
  const params = useLocalSearchParams();
  const { setAlertConfig } = useAlertContext();

  const imageAlertHelpers: ImageAlertHelpers = {
    showAlert: (title, message, type = "error") => {
      setAlertConfig({
        isVisible: true,
        title,
        message,
        type,
        onConfirm: () => {},
      });
    },
    showConfirm: (title, message) =>
      new Promise((resolve) => {
        setAlertConfig({
          isVisible: true,
          title,
          message,
          type: "warning",
          onClose: () => resolve(false),
          onConfirm: () => resolve(true),
        });
      }),
  };
  
  // Extract appointment ID from params
  const appointmentId = params.appointmentDetails
    ? JSON.parse(params.appointmentDetails as string)?.id
    : null;

  // Fetch fresh appointment details using the ID
  const {
    data: fetchedAppointmentDetails,
    isLoading: isLoadingFetchedDetails,
    refetch: refetchAppointmentDetails,
  } = useGetAppointmentDetailsQuery(
    { id: appointmentId },
    {
      skip: !appointmentId,
      refetchOnMountOrArgChange: true,
    }
  );

  // Use fetched data if available, otherwise fall back to params data
  const appointmentDetails = fetchedAppointmentDetails || 
    (params.appointmentDetails
      ? JSON.parse(params.appointmentDetails as string)
      : null);

  // Local state for captured images (before upload) - separated by segment
  const [capturedBeforeImagesInterior, setCapturedBeforeImagesInterior] =
    useState<Array<{ uri: string; type: string; filename: string }>>([]);
  const [capturedBeforeImagesExterior, setCapturedBeforeImagesExterior] =
    useState<Array<{ uri: string; type: string; filename: string }>>([]);
  const [capturedAfterImagesInterior, setCapturedAfterImagesInterior] =
    useState<Array<{ uri: string; type: string; filename: string }>>([]);
  const [capturedAfterImagesExterior, setCapturedAfterImagesExterior] =
    useState<Array<{ uri: string; type: string; filename: string }>>([]);

  // Fleet maintenance form state
  const [fleetMaintenance, setFleetMaintenance] = useState<
    Partial<FleetMaintenanceProps>
  >({
    tire_tread_depth: undefined,
    tire_condition: "",
    wiper_status: undefined,
    oil_level: undefined,
    coolant_level: undefined,
    brake_fluid_level: undefined,
    battery_condition: undefined,
    headlights_status: undefined,
    taillights_status: undefined,
    indicators_status: undefined,
    vehicle_condition_notes: "",
    damage_report: "",
  });
  const [fleetMaintenanceSubmitted, setFleetMaintenanceSubmitted] =
    useState(false);
  // String state for tire tread depth so decimals like "1." or ".5" can be typed
  const [tireTreadDepthStr, setTireTreadDepthStr] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const backgroundColor = useThemeColor({}, "background");
  const cardColor = useThemeColor({}, "cards");
  const textColor = useThemeColor({}, "text");
  const tintColor = useThemeColor({}, "tint");
  const borderColor = useThemeColor({}, "borders");

  /**
   * Capture before images for a specific segment and store them locally (no upload yet)
   */
  const handleBeforeImageCapture = async (segment: "interior" | "exterior") => {
    try {
      const images = await captureMultipleCameraImages(5, imageAlertHelpers);
      if (images && images.length > 0) {
        if (segment === "interior") {
          setCapturedBeforeImagesInterior((prev) => [...prev, ...images]);
        } else {
          setCapturedBeforeImagesExterior((prev) => [...prev, ...images]);
        }
      }
    } catch (error) {
      console.error("Error capturing before images:", error);
    }
  };

  /**
   * Capture after images for a specific segment and store them locally (no upload yet)
   */
  const handleAfterImageCapture = async (segment: "interior" | "exterior") => {
    try {
      const images = await captureMultipleCameraImages(5, imageAlertHelpers);
      if (images && images.length > 0) {
        if (segment === "interior") {
          setCapturedAfterImagesInterior((prev) => [...prev, ...images]);
        } else {
          setCapturedAfterImagesExterior((prev) => [...prev, ...images]);
        }
      }
    } catch (error) {
      console.error("Error capturing after images:", error);
    }
  };

  /**
   * Remove a before image from the preview for a specific segment
   */
  const removeBeforeImage = (
    index: number,
    segment: "interior" | "exterior"
  ) => {
    if (segment === "interior") {
      setCapturedBeforeImagesInterior((prev) =>
        prev.filter((_, i) => i !== index)
      );
    } else {
      setCapturedBeforeImagesExterior((prev) =>
        prev.filter((_, i) => i !== index)
      );
    }
  };

  /**
   * Remove an after image from the preview for a specific segment
   */
  const removeAfterImage = (
    index: number,
    segment: "interior" | "exterior"
  ) => {
    if (segment === "interior") {
      setCapturedAfterImagesInterior((prev) =>
        prev.filter((_, i) => i !== index)
      );
    } else {
      setCapturedAfterImagesExterior((prev) =>
        prev.filter((_, i) => i !== index)
      );
    }
  };

  /**
   * Handle Start Job - Upload before images for both segments first, then start appointment
   */
  const handleStartJob = async () => {
    if (!appointmentDetails?.id) return;

    try {
      // Upload before interior images if any were captured
      if (capturedBeforeImagesInterior.length > 0) {
        const formData = prepareImagesForUpload(
          capturedBeforeImagesInterior,
          appointmentDetails.id,
          "interior"
        );
        await handleUploadBeforeImages(formData);
      }

      // Upload before exterior images if any were captured
      if (capturedBeforeImagesExterior.length > 0) {
        const formData = prepareImagesForUpload(
          capturedBeforeImagesExterior,
          appointmentDetails.id,
          "exterior"
        );
        await handleUploadBeforeImages(formData);
      }

      // Start the appointment
      await handleStartAppointment(appointmentDetails.id);

      // Refetch appointment details to get updated status
      await refetchAppointmentDetails();

      // Clear captured images after successful upload
      setCapturedBeforeImagesInterior([]);
      setCapturedBeforeImagesExterior([]);
    } catch (error) {
      console.error("Error starting job:", error);
    }
  };

  /**
   * Handle Complete Job - Upload after images for both segments first, then complete appointment
   */
  const handleCompleteJob = async () => {
    if (!appointmentDetails?.id) return;

    try {
      // Upload after interior images if any were captured
      if (capturedAfterImagesInterior.length > 0) {
        const formData = prepareImagesForUpload(
          capturedAfterImagesInterior,
          appointmentDetails.id,
          "interior"
        );
        await handleUploadAfterImages(formData);
      }

      // Upload after exterior images if any were captured
      if (capturedAfterImagesExterior.length > 0) {
        const formData = prepareImagesForUpload(
          capturedAfterImagesExterior,
          appointmentDetails.id,
          "exterior"
        );
        await handleUploadAfterImages(formData);
      }

      // Complete the appointment
      await handleCompleteAppointment(appointmentDetails.id);

      // Refetch appointment details to get updated status
      await refetchAppointmentDetails();

      // Clear captured images after successful upload
      setCapturedAfterImagesInterior([]);
      setCapturedAfterImagesExterior([]);

      // Navigate back to appointments list so the screen doesn't persist and list can show fresh data
      router.back();
    } catch (error) {
      console.error("Error completing job:", error);
    }
  };

  /**
   * Handle fleet maintenance form submission
   */
  const handleFleetMaintenanceSubmit = async () => {
    if (!appointmentDetails?.id) return;

    try {
      const treadNum = parseFloat(tireTreadDepthStr);
      const payload = {
        ...fleetMaintenance,
        tire_tread_depth:
          tireTreadDepthStr.trim() === ""
            ? undefined
            : isNaN(treadNum)
              ? undefined
              : treadNum,
      };
      await handleSubmitFleetMaintenance(appointmentDetails.id, payload);
      setFleetMaintenanceSubmitted(true);
      
      // Refetch appointment details to get updated fleet maintenance data
      await refetchAppointmentDetails();
    } catch (error) {
      console.error("Error submitting fleet maintenance:", error);
    }
  };

  /**
   * Get status style based on job status
   *
   * Returns the appropriate style object for different job statuses.
   * Each status has a unique color scheme for visual distinction.
   *
   * @param status - Job status string (pending, accepted, in_progress, completed, cancelled)
   * @returns Style object for the status badge
   */
  const getStatusStyle = (status: string) => {
    switch (status) {
      case "pending":
        return styles.statusPending;
      case "accepted":
        return styles.statusAccepted;
      case "in_progress":
        return styles.statusInProgress;
      case "completed":
        return styles.statusCompleted;
      case "cancelled":
        return styles.statusCancelled;
      default:
        return styles.statusPending;
    }
  };

  /**
   * Get status icon based on job status
   *
   * Returns the appropriate Ionicons icon for different job statuses.
   *
   * @param status - Job status string
   * @returns Icon name for the status
   */
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return "time-outline";
      case "accepted":
        return "checkmark-circle-outline";
      case "in_progress":
        return "play-circle-outline";
      case "completed":
        return "checkmark-done-circle-outline";
      case "cancelled":
        return "close-circle-outline";
      default:
        return "time-outline";
    }
  };

  /**
   * Pull-to-refresh: refetch appointment details so the screen shows latest data.
   */
  const handleRefresh = async () => {
    if (!appointmentId) return;
    setRefreshing(true);
    try {
      await refetchAppointmentDetails();
    } finally {
      setRefreshing(false);
    }
  };

  const getStatusColors = (status: string) => {
    switch (status) {
      case "pending":
        return { backgroundColor: "#FEF3C7", color: "#92400E" };
      case "accepted":
        return { backgroundColor: "#DBEAFE", color: "#1E40AF" };
      case "in_progress":
        return { backgroundColor: "#D1FAE5", color: "#065F46" };
      case "completed":
        return { backgroundColor: "#D1FAE5", color: "#065F46" };
      case "cancelled":
        return { backgroundColor: "#FEE2E2", color: "#991B1B" };
      default:
        return { backgroundColor: "#FEF3C7", color: "#92400E" };
    }
  };

  // Helper function to render status dropdown/picker
  const renderStatusPicker = (
    label: string,
    value: string | undefined,
    options: Array<{ label: string; value: string }>,
    onSelect: (value: string) => void
  ) => {
    return (
      <View style={styles.pickerContainer}>
        <StyledText variant="bodyMedium" style={{ marginBottom: 8 }}>
          {label}
        </StyledText>
        <View style={styles.pickerOptions}>
          {options.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.pickerOption,
                value === option.value && [
                  styles.pickerOptionSelected,
                  { backgroundColor: tintColor, borderColor: tintColor },
                ],
                { borderColor },
              ]}
              onPress={() => onSelect(option.value)}
            >
              <StyledText
                variant="bodySmall"
                style={{
                  color: value === option.value ? "#fff" : textColor,
                }}
              >
                {option.label}
              </StyledText>
              {value === option.value && (
                <Ionicons name="checkmark" size={16} color="#fff" />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };
  /**
   * Render action buttons based on current status
   *
   * Displays different action buttons depending on the appointment status.
   * Each status has appropriate actions that can be performed.
   *
   * @returns View component with action buttons
   */
  const renderActionButtons = () => {
    switch (appointmentDetails?.status) {
      case "pending":
        return (
          <View style={styles.sleekButtonContainer}>
            <StyledText variant="bodyMedium" style={styles.sleekButtonText}>
              Assigned – use Start when ready (or wait for sync).
            </StyledText>
          </View>
        );
      case "accepted":
        // Get uploaded and captured image counts
        const beforeInteriorUploaded =
          appointmentDetails?.before_images_interior?.length || 0;
        const beforeExteriorUploaded =
          appointmentDetails?.before_images_exterior?.length || 0;
        const beforeInteriorTotal =
          beforeInteriorUploaded + capturedBeforeImagesInterior.length;
        const beforeExteriorTotal =
          beforeExteriorUploaded + capturedBeforeImagesExterior.length;
        const canStartJob =
          beforeInteriorTotal >= 4 && beforeExteriorTotal >= 4;

        return (
          <View style={styles.buttonContainer}>
            <StyledButton
              key="start"
              variant="tonal"
              onPress={handleStartJob}
              disabled={isLoadingUploadBeforeImages || !canStartJob}
            >
              {isLoadingUploadBeforeImages ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <StyledText variant="labelLarge">Start Job</StyledText>
              )}
            </StyledButton>
          </View>
        );
      case "in_progress":
        // Get uploaded and captured image counts
        const afterInteriorUploaded =
          appointmentDetails?.after_images_interior?.length || 0;
        const afterExteriorUploaded =
          appointmentDetails?.after_images_exterior?.length || 0;
        const afterInteriorTotal =
          afterInteriorUploaded + capturedAfterImagesInterior.length;
        const afterExteriorTotal =
          afterExteriorUploaded + capturedAfterImagesExterior.length;
        const canCompleteJob =
          afterInteriorTotal >= 4 &&
          afterExteriorTotal >= 4 &&
          fleetMaintenanceSubmitted;

        return (
          <View style={styles.buttonContainer}>
            <StyledButton
              key="complete"
              variant="tonal"
              onPress={handleCompleteJob}
              disabled={
                isLoadingUploadAfterImages ||
                isLoadingSubmitFleetMaintenance ||
                !canCompleteJob
              }
            >
              {isLoadingUploadAfterImages || isLoadingSubmitFleetMaintenance ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <StyledText variant="labelLarge">Complete Job</StyledText>
              )}
            </StyledButton>
          </View>
        );
      case "completed":
        return (
          <View style={styles.completedMessageContainer}>
            <View style={styles.completedMessage}>
              <Ionicons name="checkmark-done-circle" size={24} color="#28a745" />
              <StyledText variant="labelLarge">
                Job completed successfully
              </StyledText>
            </View>
            <StyledButton
              variant="tonal"
              onPress={() => router.back()}
              style={styles.backToListButton}
            >
              <StyledText variant="labelLarge">Back to appointments</StyledText>
            </StyledButton>
          </View>
        );
      case "cancelled":
        return (
          <View style={styles.completedMessageContainer}>
            <View style={styles.completedMessage}>
              <Ionicons name="close-circle" size={24} color="#dc3545" />
              <StyledText variant="labelLarge">Job was cancelled</StyledText>
            </View>
            <StyledButton
              variant="tonal"
              onPress={() => router.back()}
              style={styles.backToListButton}
            >
              <StyledText variant="labelLarge">Back to appointments</StyledText>
            </StyledButton>
          </View>
        );
      default:
        return null;
    }
  };

  if (isLoadingAppointmentDetails || (isLoadingFetchedDetails && appointmentId)) {
    return (
      <View style={[styles.container, { backgroundColor }]}>
        <ActivityIndicator size="large" color={tintColor} />
      </View>
    );
  }

  const status = appointmentDetails?.status || "";
  const statusColors = getStatusColors(status);
  const statusIcon = getStatusIcon(status);

  return (
    <View style={[styles.container, { backgroundColor }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          { backgroundColor: cardColor, borderBottomColor: borderColor },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.headerBack}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="arrow-back" size={24} color={textColor} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <StyledText variant="titleMedium" style={{ color: textColor }}>
            Job details
          </StyledText>
          <StyledText
            variant="bodySmall"
            style={[styles.headerRef, { color: textColor }]}
          >
            #{appointmentDetails?.booking_reference}
          </StyledText>
        </View>
        <TouchableOpacity
          onPress={handleRefresh}
          disabled={refreshing}
          style={styles.headerBack}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          {refreshing ? (
            <ActivityIndicator size="small" color={tintColor} />
          ) : (
            <Ionicons name="refresh" size={24} color={textColor} />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={tintColor}
          />
        }
      >
        {/* Status pill */}
        <View
          style={[
            styles.statusPill,
            {
              backgroundColor: statusColors.backgroundColor,
              borderColor: statusColors.color,
            },
          ]}
        >
          <Ionicons name={statusIcon} size={22} color={statusColors.color} />
          <StyledText
            variant="labelLarge"
            style={[styles.statusPillText, { color: statusColors.color }]}
          >
            {status.replace("_", " ").toUpperCase()}
          </StyledText>
        </View>

        {/* Client */}
        <View style={[styles.sectionCard, { backgroundColor: cardColor, borderColor }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="person-outline" size={20} color={tintColor} />
            <StyledText variant="labelLarge" style={{ color: textColor }}>
              Client
            </StyledText>
          </View>
          <View style={styles.infoContainer}>
            <View style={styles.infoRow}>
              <Ionicons name="person" size={18} color={tintColor} />
              <StyledText variant="bodyMedium" style={{ color: textColor }}>
                {appointmentDetails?.client_name}
              </StyledText>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="call" size={18} color={tintColor} />
              <StyledText variant="bodyMedium" style={{ color: textColor }}>
                {appointmentDetails?.client_phone}
              </StyledText>
            </View>
          </View>
        </View>

        {/* Vehicle */}
        <View style={[styles.sectionCard, { backgroundColor: cardColor, borderColor }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="car-outline" size={20} color={tintColor} />
            <StyledText variant="labelLarge" style={{ color: textColor }}>
              Vehicle
            </StyledText>
          </View>
          <View style={styles.infoContainer}>
            <View style={styles.infoRow}>
              <Ionicons name="car" size={18} color={tintColor} />
              <StyledText variant="bodyMedium" style={{ color: textColor }}>
                {appointmentDetails?.vehicle_year}{" "}
                {appointmentDetails?.vehicle_make}{" "}
                {appointmentDetails?.vehicle_model}
              </StyledText>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="color-palette" size={18} color={tintColor} />
              <StyledText variant="bodyMedium" style={{ color: textColor }}>
                {appointmentDetails?.vehicle_color}
              </StyledText>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="card" size={18} color={tintColor} />
              <StyledText variant="bodyMedium" style={{ color: textColor }}>
                {appointmentDetails?.vehiclie_license}
              </StyledText>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="water" size={18} color={tintColor} />
              <StyledText variant="bodyMedium" style={{ color: textColor }}>
                {appointmentDetails?.valet_type}
              </StyledText>
            </View>
          </View>
        </View>

        {/* Location */}
        <View style={[styles.sectionCard, { backgroundColor: cardColor, borderColor }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="location-outline" size={20} color={tintColor} />
            <StyledText variant="labelLarge" style={{ color: textColor }}>
              Location
            </StyledText>
          </View>
          <View style={styles.infoContainer}>
            <View style={styles.infoRow}>
              <Ionicons name="location" size={18} color={tintColor} />
              <StyledText variant="bodyMedium" style={{ color: textColor }}>
                {appointmentDetails?.address}
              </StyledText>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="location" size={18} color={tintColor} />
              <StyledText variant="bodyMedium" style={{ color: textColor }}>
                {appointmentDetails?.city}, {appointmentDetails?.post_code}
              </StyledText>
            </View>
          </View>
        </View>

        {/* Service */}
        <View style={[styles.sectionCard, { backgroundColor: cardColor, borderColor }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="construct-outline" size={20} color={tintColor} />
            <StyledText variant="labelLarge" style={{ color: textColor }}>
              Service
            </StyledText>
          </View>
          <View style={styles.infoContainer}>
            <View style={styles.infoRow}>
              <StyledText variant="bodyMedium" style={{ color: textColor, fontWeight: "600" }}>
                {appointmentDetails?.service_type.name}
              </StyledText>
            </View>
            <View style={styles.infoRow}>
              <View style={styles.descriptionContainer}>
                {appointmentDetails?.service_type.description.map(
                  (desc: string, index: number) => (
                    <StyledText
                      key={index}
                      variant="bodyMedium"
                      style={[styles.descriptionItem, { color: textColor }]}
                    >
                      • {desc}
                    </StyledText>
                  )
                )}
              </View>
            </View>
          </View>
        </View>

        {/* Schedule */}
        <View style={[styles.sectionCard, { backgroundColor: cardColor, borderColor }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="time-outline" size={20} color={tintColor} />
            <StyledText variant="labelLarge" style={{ color: textColor }}>
              Schedule
            </StyledText>
          </View>
          <View style={styles.infoContainer}>
            <View style={styles.infoRow}>
              <Ionicons name="time" size={18} color={tintColor} />
              <StyledText variant="bodyMedium" style={{ color: textColor }}>
                {appointmentDetails?.appointment_time} ·{" "}
                {appointmentDetails?.duration} min
              </StyledText>
            </View>
          </View>
        </View>

        {/* Addons */}
        {appointmentDetails?.addons && appointmentDetails.addons.length > 0 && (
          <View style={[styles.sectionCard, { backgroundColor: cardColor, borderColor }]}>
            <View style={styles.sectionHeader}>
              <Ionicons name="add-circle-outline" size={20} color={tintColor} />
              <StyledText variant="labelLarge" style={{ color: textColor }}>
                Add-ons
              </StyledText>
            </View>
            <View style={styles.infoContainer}>
              {appointmentDetails.addons.map((addon: string, index: number) => (
                <View key={index} style={styles.infoRow}>
                  <Ionicons name="add-circle" size={18} color={tintColor} />
                  <StyledText variant="bodyMedium" style={{ color: textColor }}>{addon}</StyledText>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Loyalty */}
        {(appointmentDetails?.loyalty_tier ||
          appointmentDetails?.loyalty_benefits) && (
          <View style={[styles.sectionCard, { backgroundColor: cardColor, borderColor }]}>
            <View style={styles.sectionHeader}>
              <Ionicons name="star-outline" size={20} color={tintColor} />
              <StyledText variant="labelLarge" style={{ color: textColor }}>
                Loyalty
              </StyledText>
            </View>
            <View style={styles.infoContainer}>
              {appointmentDetails?.loyalty_tier && (
                <View style={styles.infoRow}>
                  <Ionicons name="star" size={18} color={tintColor} />
                  <StyledText variant="bodyMedium" style={{ color: textColor }}>
                    {appointmentDetails.loyalty_tier.charAt(0).toUpperCase() +
                      appointmentDetails.loyalty_tier.slice(1)}
                  </StyledText>
                </View>
              )}
              {appointmentDetails?.loyalty_benefits &&
                appointmentDetails.loyalty_benefits.length > 0 && (
                  <View style={styles.infoRow}>
                    <Ionicons name="gift" size={18} color={tintColor} />
                    <View style={styles.descriptionContainer}>
                      {appointmentDetails.loyalty_benefits.map(
                        (benefit: string, index: number) => (
                          <StyledText
                            key={index}
                            variant="bodyMedium"
                            style={[styles.descriptionItem, { color: textColor }]}
                          >
                            • {benefit}
                          </StyledText>
                        )
                      )}
                    </View>
                  </View>
                )}
            </View>
          </View>
        )}

        {/* Notes */}
        <View style={[styles.sectionCard, { backgroundColor: cardColor, borderColor }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="document-text-outline" size={20} color={tintColor} />
            <StyledText variant="labelLarge" style={{ color: textColor }}>
              Notes
            </StyledText>
          </View>
          <View style={styles.infoContainer}>
            <View style={styles.infoRow}>
              <StyledText variant="bodyMedium" style={{ color: textColor }}>
                {appointmentDetails?.special_instruction ||
                  "No special instructions"}
              </StyledText>
            </View>
          </View>
        </View>

        {/* Before Images - Only show when status is "accepted" */}
        {appointmentDetails?.status === "accepted" && (
          <View style={[styles.sectionCard, { backgroundColor: cardColor, borderColor }]}>
            <View style={styles.sectionHeader}>
              <Ionicons name="images-outline" size={20} color={tintColor} />
              <StyledText variant="labelLarge" style={{ color: textColor }}>
                Before images
              </StyledText>
            </View>

            {/* Before Images - Interior */}
            <View style={styles.imageSection}>
              <View style={styles.imageSectionHeader}>
                <Ionicons name="images" size={20} color={tintColor} />
                <StyledText variant="bodySmall">
                  Interior - Uploaded:{" "}
                  {appointmentDetails?.before_images_interior?.length || 0} |
                  Captured: {capturedBeforeImagesInterior.length} (
                  {(appointmentDetails?.before_images_interior?.length || 0) +
                    capturedBeforeImagesInterior.length >=
                  4
                    ? "✓"
                    : `${
                        (appointmentDetails?.before_images_interior?.length ||
                          0) + capturedBeforeImagesInterior.length
                      }/4`}
                  )
                </StyledText>
              </View>

              <View style={styles.imageGrid}>
                {/* Show already uploaded interior images */}
                {appointmentDetails?.before_images_interior &&
                  appointmentDetails.before_images_interior.map(
                    (img: any, index: number) => (
                      <View
                        key={`uploaded-interior-${index}`}
                        style={styles.imageContainer}
                      >
                        <Image
                          source={{ uri: img.image_url }}
                          style={styles.uploadedImage}
                        />
                      </View>
                    )
                  )}

                {/* Show captured interior images (not yet uploaded) with remove button */}
                {capturedBeforeImagesInterior.map((img, index) => (
                  <View
                    key={`captured-interior-${index}`}
                    style={styles.imageContainer}
                  >
                    <Image
                      source={{ uri: img.uri }}
                      style={styles.uploadedImage}
                    />
                    <TouchableOpacity
                      style={styles.removeButton}
                      onPress={() => removeBeforeImage(index, "interior")}
                    >
                      <Ionicons name="close-circle" size={24} color="#dc3545" />
                    </TouchableOpacity>
                  </View>
                ))}

                {/* Capture button */}
                <TouchableOpacity
                  style={[styles.uploadButton, { borderColor }]}
                  onPress={() => handleBeforeImageCapture("interior")}
                >
                  <Ionicons name="camera" size={24} color={tintColor} />
                  <StyledText variant="bodySmall">
                    {capturedBeforeImagesInterior.length === 0
                      ? "Capture Interior"
                      : "Capture More"}
                  </StyledText>
                </TouchableOpacity>
              </View>
            </View>

            {/* Before Images - Exterior */}
            <View style={styles.imageSection}>
              <View style={styles.imageSectionHeader}>
                <Ionicons name="images" size={20} color={tintColor} />
                <StyledText variant="bodySmall">
                  Exterior - Uploaded:{" "}
                  {appointmentDetails?.before_images_exterior?.length || 0} |
                  Captured: {capturedBeforeImagesExterior.length} (
                  {(appointmentDetails?.before_images_exterior?.length || 0) +
                    capturedBeforeImagesExterior.length >=
                  4
                    ? "✓"
                    : `${
                        (appointmentDetails?.before_images_exterior?.length ||
                          0) + capturedBeforeImagesExterior.length
                      }/4`}
                  )
                </StyledText>
              </View>

              <View style={styles.imageGrid}>
                {/* Show already uploaded exterior images */}
                {appointmentDetails?.before_images_exterior &&
                  appointmentDetails.before_images_exterior.map(
                    (img: any, index: number) => (
                      <View
                        key={`uploaded-exterior-${index}`}
                        style={styles.imageContainer}
                      >
                        <Image
                          source={{ uri: img.image_url }}
                          style={styles.uploadedImage}
                        />
                      </View>
                    )
                  )}

                {/* Show captured exterior images (not yet uploaded) with remove button */}
                {capturedBeforeImagesExterior.map((img, index) => (
                  <View
                    key={`captured-exterior-${index}`}
                    style={styles.imageContainer}
                  >
                    <Image
                      source={{ uri: img.uri }}
                      style={styles.uploadedImage}
                    />
                    <TouchableOpacity
                      style={styles.removeButton}
                      onPress={() => removeBeforeImage(index, "exterior")}
                    >
                      <Ionicons name="close-circle" size={24} color="#dc3545" />
                    </TouchableOpacity>
                  </View>
                ))}

                {/* Capture button */}
                <TouchableOpacity
                  style={[styles.uploadButton, { borderColor }]}
                  onPress={() => handleBeforeImageCapture("exterior")}
                >
                  <Ionicons name="camera" size={24} color={tintColor} />
                  <StyledText variant="bodySmall">
                    {capturedBeforeImagesExterior.length === 0
                      ? "Capture Exterior"
                      : "Capture More"}
                  </StyledText>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* After Images - Only show when status is "in_progress" */}
        {appointmentDetails?.status === "in_progress" && (
          <>
            <View style={[styles.sectionCard, { backgroundColor: cardColor, borderColor }]}>
              <View style={styles.sectionHeader}>
                <Ionicons name="images-outline" size={20} color={tintColor} />
                <StyledText variant="labelLarge" style={{ color: textColor }}>
                  After images
                </StyledText>
              </View>

              {/* After Images - Interior */}
              <View style={styles.imageSection}>
                <View style={styles.imageSectionHeader}>
                  <Ionicons name="images" size={20} color={tintColor} />
                  <StyledText variant="bodySmall">
                    Interior - Uploaded:{" "}
                    {appointmentDetails?.after_images_interior?.length || 0} |
                    Captured: {capturedAfterImagesInterior.length} (
                    {(appointmentDetails?.after_images_interior?.length || 0) +
                      capturedAfterImagesInterior.length >=
                    4
                      ? "✓"
                      : `${
                          (appointmentDetails?.after_images_interior?.length ||
                            0) + capturedAfterImagesInterior.length
                        }/4`}
                    )
                  </StyledText>
                </View>

                <View style={styles.imageGrid}>
                  {/* Show already uploaded interior images */}
                  {appointmentDetails?.after_images_interior &&
                    appointmentDetails.after_images_interior.map(
                      (img: any, index: number) => (
                        <View
                          key={`uploaded-after-interior-${index}`}
                          style={styles.imageContainer}
                        >
                          <Image
                            source={{ uri: img.image_url }}
                            style={styles.uploadedImage}
                          />
                        </View>
                      )
                    )}

                  {/* Show captured interior images (not yet uploaded) with remove button */}
                  {capturedAfterImagesInterior.map((img, index) => (
                    <View
                      key={`captured-after-interior-${index}`}
                      style={styles.imageContainer}
                    >
                      <Image
                        source={{ uri: img.uri }}
                        style={styles.uploadedImage}
                      />
                      <TouchableOpacity
                        style={styles.removeButton}
                        onPress={() => removeAfterImage(index, "interior")}
                      >
                        <Ionicons
                          name="close-circle"
                          size={24}
                          color="#dc3545"
                        />
                      </TouchableOpacity>
                    </View>
                  ))}

                  {/* Capture button */}
                  <TouchableOpacity
                    style={[styles.uploadButton, { borderColor }]}
                    onPress={() => handleAfterImageCapture("interior")}
                  >
                    <Ionicons name="camera" size={24} color={tintColor} />
                    <StyledText variant="bodySmall">
                      {capturedAfterImagesInterior.length === 0
                        ? "Capture Interior"
                        : "Capture More"}
                    </StyledText>
                  </TouchableOpacity>
                </View>
              </View>

              {/* After Images - Exterior */}
              <View style={styles.imageSection}>
                <View style={styles.imageSectionHeader}>
                  <Ionicons name="images" size={20} color={tintColor} />
                  <StyledText variant="bodySmall">
                    Exterior - Uploaded:{" "}
                    {appointmentDetails?.after_images_exterior?.length || 0} |
                    Captured: {capturedAfterImagesExterior.length} (
                    {(appointmentDetails?.after_images_exterior?.length || 0) +
                      capturedAfterImagesExterior.length >=
                    4
                      ? "✓"
                      : `${
                          (appointmentDetails?.after_images_exterior?.length ||
                            0) + capturedAfterImagesExterior.length
                        }/4`}
                    )
                  </StyledText>
                </View>

                <View style={styles.imageGrid}>
                  {/* Show already uploaded exterior images */}
                  {appointmentDetails?.after_images_exterior &&
                    appointmentDetails.after_images_exterior.map(
                      (img: any, index: number) => (
                        <View
                          key={`uploaded-after-exterior-${index}`}
                          style={styles.imageContainer}
                        >
                          <Image
                            source={{ uri: img.image_url }}
                            style={styles.uploadedImage}
                          />
                        </View>
                      )
                    )}

                  {/* Show captured exterior images (not yet uploaded) with remove button */}
                  {capturedAfterImagesExterior.map((img, index) => (
                    <View
                      key={`captured-after-exterior-${index}`}
                      style={styles.imageContainer}
                    >
                      <Image
                        source={{ uri: img.uri }}
                        style={styles.uploadedImage}
                      />
                      <TouchableOpacity
                        style={styles.removeButton}
                        onPress={() => removeAfterImage(index, "exterior")}
                      >
                        <Ionicons
                          name="close-circle"
                          size={24}
                          color="#dc3545"
                        />
                      </TouchableOpacity>
                    </View>
                  ))}

                  {/* Capture button */}
                  <TouchableOpacity
                    style={[styles.uploadButton, { borderColor }]}
                    onPress={() => handleAfterImageCapture("exterior")}
                  >
                    <Ionicons name="camera" size={24} color={tintColor} />
                    <StyledText variant="bodySmall">
                      {capturedAfterImagesExterior.length === 0
                        ? "Capture Exterior"
                        : "Capture More"}
                    </StyledText>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Fleet Maintenance Form */}
            <View style={[styles.sectionCard, { backgroundColor: cardColor, borderColor }]}>
              <View style={styles.sectionHeader}>
                <Ionicons name="construct-outline" size={20} color={tintColor} />
                <StyledText variant="labelLarge" style={{ color: textColor }}>
                  Fleet maintenance
                </StyledText>
              </View>
              {fleetMaintenanceSubmitted && (
                <View style={styles.successIndicator}>
                  <Ionicons name="checkmark-circle" size={20} color="#28a745" />
                  <StyledText
                    variant="bodySmall"
                    style={{ color: "#28a745", marginLeft: 8 }}
                  >
                    Maintenance data submitted
                  </StyledText>
                </View>
              )}

              <View style={styles.fleetMaintenanceForm}>
                {/* Tire Tread Depth */}
                <StyledTextInput
                  label="Tire Tread Depth (mm)"
                  placeholder="Enter tread depth in mm"
                  value={tireTreadDepthStr}
                  onChangeText={(text) => {
                    const filtered = text.replace(/[^0-9.]/g, "");
                    const parts = filtered.split(".");
                    const allowed =
                      parts.length > 2
                        ? parts[0] + "." + parts.slice(1).join("")
                        : filtered;
                    setTireTreadDepthStr(allowed);
                  }}
                  onBlur={() => {
                    const trimmed = tireTreadDepthStr.trim();
                    const num = parseFloat(trimmed);
                    setFleetMaintenance((prev) => ({
                      ...prev,
                      tire_tread_depth:
                        trimmed === ""
                          ? undefined
                          : isNaN(num)
                            ? undefined
                            : num,
                    }));
                  }}
                  keyboardType="decimal-pad"
                  inputMode="decimal"
                  style={styles.formInput}
                />

                {/* Tire Condition */}
                <StyledTextInput
                  label="Tire Condition"
                  placeholder="Notes about tire condition"
                  value={fleetMaintenance.tire_condition || ""}
                  onChangeText={(text) =>
                    setFleetMaintenance({
                      ...fleetMaintenance,
                      tire_condition: text,
                    })
                  }
                  multiline
                  numberOfLines={2}
                  style={styles.formInput}
                />

                {/* Wiper Status */}
                {renderStatusPicker(
                  "Wiper Status",
                  fleetMaintenance.wiper_status,
                  [
                    { label: "Good", value: "good" },
                    { label: "Needs Work", value: "needs_work" },
                    { label: "Bad", value: "bad" },
                  ],
                  (value) =>
                    setFleetMaintenance({
                      ...fleetMaintenance,
                      wiper_status: value as "good" | "needs_work" | "bad",
                    })
                )}

                {/* Oil Level */}
                {renderStatusPicker(
                  "Oil Level",
                  fleetMaintenance.oil_level,
                  [
                    { label: "Good", value: "good" },
                    { label: "Low", value: "low" },
                    { label: "Needs Change", value: "needs_change" },
                  ],
                  (value) =>
                    setFleetMaintenance({
                      ...fleetMaintenance,
                      oil_level: value as "good" | "low" | "needs_change",
                    })
                )}

                {/* Coolant Level */}
                {renderStatusPicker(
                  "Coolant Level",
                  fleetMaintenance.coolant_level,
                  [
                    { label: "Good", value: "good" },
                    { label: "Low", value: "low" },
                    { label: "Needs Refill", value: "needs_refill" },
                  ],
                  (value) =>
                    setFleetMaintenance({
                      ...fleetMaintenance,
                      coolant_level: value as "good" | "low" | "needs_refill",
                    })
                )}

                {/* Brake Fluid Level */}
                {renderStatusPicker(
                  "Brake Fluid Level",
                  fleetMaintenance.brake_fluid_level,
                  [
                    { label: "Good", value: "good" },
                    { label: "Low", value: "low" },
                    { label: "Needs Refill", value: "needs_refill" },
                  ],
                  (value) =>
                    setFleetMaintenance({
                      ...fleetMaintenance,
                      brake_fluid_level: value as
                        | "good"
                        | "low"
                        | "needs_refill",
                    })
                )}

                {/* Battery Condition */}
                {renderStatusPicker(
                  "Battery Condition",
                  fleetMaintenance.battery_condition,
                  [
                    { label: "Good", value: "good" },
                    { label: "Weak", value: "weak" },
                    { label: "Replace", value: "replace" },
                  ],
                  (value) =>
                    setFleetMaintenance({
                      ...fleetMaintenance,
                      battery_condition: value as "good" | "weak" | "replace",
                    })
                )}

                {/* Headlights Status */}
                {renderStatusPicker(
                  "Headlights Status",
                  fleetMaintenance.headlights_status,
                  [
                    { label: "Working", value: "working" },
                    { label: "Dim", value: "dim" },
                    { label: "Not Working", value: "not_working" },
                  ],
                  (value) =>
                    setFleetMaintenance({
                      ...fleetMaintenance,
                      headlights_status: value as
                        | "working"
                        | "dim"
                        | "not_working",
                    })
                )}

                {/* Taillights Status */}
                {renderStatusPicker(
                  "Taillights Status",
                  fleetMaintenance.taillights_status,
                  [
                    { label: "Working", value: "working" },
                    { label: "Dim", value: "dim" },
                    { label: "Not Working", value: "not_working" },
                  ],
                  (value) =>
                    setFleetMaintenance({
                      ...fleetMaintenance,
                      taillights_status: value as
                        | "working"
                        | "dim"
                        | "not_working",
                    })
                )}

                {/* Indicators Status */}
                {renderStatusPicker(
                  "Indicators Status",
                  fleetMaintenance.indicators_status,
                  [
                    { label: "Working", value: "working" },
                    { label: "Not Working", value: "not_working" },
                  ],
                  (value) =>
                    setFleetMaintenance({
                      ...fleetMaintenance,
                      indicators_status: value as "working" | "not_working",
                    })
                )}

                {/* Vehicle Condition Notes */}
                <StyledTextInput
                  label="Vehicle Condition Notes (Optional)"
                  placeholder="General observations about vehicle condition"
                  value={fleetMaintenance.vehicle_condition_notes || ""}
                  onChangeText={(text) =>
                    setFleetMaintenance({
                      ...fleetMaintenance,
                      vehicle_condition_notes: text,
                    })
                  }
                  multiline
                  numberOfLines={3}
                  style={styles.formInput}
                />

                {/* Damage Report */}
                <StyledTextInput
                  label="Damage Report (Optional)"
                  placeholder="Notes about any visible damage"
                  value={fleetMaintenance.damage_report || ""}
                  onChangeText={(text) =>
                    setFleetMaintenance({
                      ...fleetMaintenance,
                      damage_report: text,
                    })
                  }
                  multiline
                  numberOfLines={3}
                  style={styles.formInput}
                />

                {/* Submit Button */}
                {!fleetMaintenanceSubmitted && (
                  <StyledButton
                    variant="tonal"
                    onPress={handleFleetMaintenanceSubmit}
                    disabled={isLoadingSubmitFleetMaintenance}
                    style={{ marginTop: 16 }}
                  >
                    {isLoadingSubmitFleetMaintenance ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <StyledText variant="labelLarge">
                        Submit Maintenance Data
                      </StyledText>
                    )}
                  </StyledButton>
                )}
              </View>
            </View>
          </>
        )}

        {/* Both Images - Show when completed or other statuses */}
        {(appointmentDetails?.status === "completed" ||
          appointmentDetails?.status === "cancelled" ||
          appointmentDetails?.status === "pending") && (
          <>
            <View style={[styles.sectionCard, { backgroundColor: cardColor, borderColor }]}>
              <View style={styles.sectionHeader}>
                <Ionicons name="images-outline" size={20} color={tintColor} />
                <StyledText variant="labelLarge" style={{ color: textColor }}>
                  Before & after images
                </StyledText>
              </View>

              {/* Before Images - Interior */}
              <View style={styles.imageSection}>
                <View style={styles.imageSectionHeader}>
                  <Ionicons name="images" size={20} color={tintColor} />
                  <StyledText variant="bodySmall">
                    Before Images - Interior (
                    {appointmentDetails?.before_images_interior?.length || 0})
                  </StyledText>
                </View>
                <View style={styles.imageGrid}>
                  {appointmentDetails?.before_images_interior &&
                  appointmentDetails.before_images_interior.length > 0 ? (
                    appointmentDetails.before_images_interior.map(
                      (img: any, index: number) => (
                        <View key={index} style={styles.imageContainer}>
                          <Image
                            source={{ uri: img.image_url }}
                            style={styles.uploadedImage}
                          />
                        </View>
                      )
                    )
                  ) : (
                    <StyledText variant="bodySmall">
                      No before interior images
                    </StyledText>
                  )}
                </View>
              </View>

              {/* Before Images - Exterior */}
              <View style={styles.imageSection}>
                <View style={styles.imageSectionHeader}>
                  <Ionicons name="images" size={20} color={tintColor} />
                  <StyledText variant="bodySmall">
                    Before Images - Exterior (
                    {appointmentDetails?.before_images_exterior?.length || 0})
                  </StyledText>
                </View>
                <View style={styles.imageGrid}>
                  {appointmentDetails?.before_images_exterior &&
                  appointmentDetails.before_images_exterior.length > 0 ? (
                    appointmentDetails.before_images_exterior.map(
                      (img: any, index: number) => (
                        <View key={index} style={styles.imageContainer}>
                          <Image
                            source={{ uri: img.image_url }}
                            style={styles.uploadedImage}
                          />
                        </View>
                      )
                    )
                  ) : (
                    <StyledText variant="bodySmall">
                      No before exterior images
                    </StyledText>
                  )}
                </View>
              </View>

              {/* After Images - Interior */}
              <View style={styles.imageSection}>
                <View style={styles.imageSectionHeader}>
                  <Ionicons name="images" size={20} color={tintColor} />
                  <StyledText variant="bodySmall">
                    After Images - Interior (
                    {appointmentDetails?.after_images_interior?.length || 0})
                  </StyledText>
                </View>
                <View style={styles.imageGrid}>
                  {appointmentDetails?.after_images_interior &&
                  appointmentDetails.after_images_interior.length > 0 ? (
                    appointmentDetails.after_images_interior.map(
                      (img: any, index: number) => (
                        <View key={index} style={styles.imageContainer}>
                          <Image
                            source={{ uri: img.image_url }}
                            style={styles.uploadedImage}
                          />
                        </View>
                      )
                    )
                  ) : (
                    <StyledText variant="bodySmall">
                      No after interior images
                    </StyledText>
                  )}
                </View>
              </View>

              {/* After Images - Exterior */}
              <View style={styles.imageSection}>
                <View style={styles.imageSectionHeader}>
                  <Ionicons name="images" size={20} color={tintColor} />
                  <StyledText variant="bodySmall">
                    After Images - Exterior (
                    {appointmentDetails?.after_images_exterior?.length || 0})
                  </StyledText>
                </View>
                <View style={styles.imageGrid}>
                  {appointmentDetails?.after_images_exterior &&
                  appointmentDetails.after_images_exterior.length > 0 ? (
                    appointmentDetails.after_images_exterior.map(
                      (img: any, index: number) => (
                        <View key={index} style={styles.imageContainer}>
                          <Image
                            source={{ uri: img.image_url }}
                            style={styles.uploadedImage}
                          />
                        </View>
                      )
                    )
                  ) : (
                    <StyledText variant="bodySmall">
                      No after exterior images
                    </StyledText>
                  )}
                </View>
              </View>
            </View>

            {/* Fleet Maintenance Data - Show when completed */}
            {appointmentDetails?.status === "completed" &&
              appointmentDetails?.fleet_maintenance && (
                <View style={[styles.sectionCard, { backgroundColor: cardColor, borderColor }]}>
                  <View style={styles.sectionHeader}>
                    <Ionicons name="construct-outline" size={20} color={tintColor} />
                    <StyledText variant="labelLarge" style={{ color: textColor }}>
                      Fleet maintenance
                    </StyledText>
                  </View>
                  <View style={styles.infoContainer}>
                    {appointmentDetails.fleet_maintenance.tire_tread_depth && (
                      <View style={styles.infoRow}>
                        <Ionicons name="car" size={15} color={tintColor} />
                        <StyledText variant="bodyMedium">
                          Tire Tread Depth:{" "}
                          {
                            appointmentDetails.fleet_maintenance
                              .tire_tread_depth
                          }{" "}
                          mm
                        </StyledText>
                      </View>
                    )}
                    {appointmentDetails.fleet_maintenance.tire_condition && (
                      <View style={styles.infoRow}>
                        <Ionicons
                          name="document-text"
                          size={15}
                          color={tintColor}
                        />
                        <StyledText variant="bodyMedium">
                          Tire Condition:{" "}
                          {appointmentDetails.fleet_maintenance.tire_condition}
                        </StyledText>
                      </View>
                    )}
                    {appointmentDetails.fleet_maintenance.wiper_status && (
                      <View style={styles.infoRow}>
                        <Ionicons name="water" size={15} color={tintColor} />
                        <StyledText variant="bodyMedium">
                          Wiper Status:{" "}
                          {appointmentDetails.fleet_maintenance.wiper_status
                            .replace("_", " ")
                            .replace(/\b\w/g, (l: string) => l.toUpperCase())}
                        </StyledText>
                      </View>
                    )}
                    {appointmentDetails.fleet_maintenance.oil_level && (
                      <View style={styles.infoRow}>
                        <Ionicons name="flask" size={15} color={tintColor} />
                        <StyledText variant="bodyMedium">
                          Oil Level:{" "}
                          {appointmentDetails.fleet_maintenance.oil_level
                            .replace("_", " ")
                            .replace(/\b\w/g, (l: string) => l.toUpperCase())}
                        </StyledText>
                      </View>
                    )}
                    {appointmentDetails.fleet_maintenance.coolant_level && (
                      <View style={styles.infoRow}>
                        <Ionicons
                          name="thermometer"
                          size={15}
                          color={tintColor}
                        />
                        <StyledText variant="bodyMedium">
                          Coolant Level:{" "}
                          {appointmentDetails.fleet_maintenance.coolant_level
                            .replace("_", " ")
                            .replace(/\b\w/g, (l: string) => l.toUpperCase())}
                        </StyledText>
                      </View>
                    )}
                    {appointmentDetails.fleet_maintenance.brake_fluid_level && (
                      <View style={styles.infoRow}>
                        <Ionicons name="disc" size={15} color={tintColor} />
                        <StyledText variant="bodyMedium">
                          Brake Fluid:{" "}
                          {appointmentDetails.fleet_maintenance.brake_fluid_level
                            .replace("_", " ")
                            .replace(/\b\w/g, (l: string) => l.toUpperCase())}
                        </StyledText>
                      </View>
                    )}
                    {appointmentDetails.fleet_maintenance.battery_condition && (
                      <View style={styles.infoRow}>
                        <Ionicons
                          name="battery-charging"
                          size={15}
                          color={tintColor}
                        />
                        <StyledText variant="bodyMedium">
                          Battery:{" "}
                          {appointmentDetails.fleet_maintenance.battery_condition.replace(
                            /\b\w/g,
                            (l: string) => l.toUpperCase()
                          )}
                        </StyledText>
                      </View>
                    )}
                    {appointmentDetails.fleet_maintenance.headlights_status && (
                      <View style={styles.infoRow}>
                        <Ionicons name="bulb" size={15} color={tintColor} />
                        <StyledText variant="bodyMedium">
                          Headlights:{" "}
                          {appointmentDetails.fleet_maintenance.headlights_status
                            .replace("_", " ")
                            .replace(/\b\w/g, (l: string) => l.toUpperCase())}
                        </StyledText>
                      </View>
                    )}
                    {appointmentDetails.fleet_maintenance.taillights_status && (
                      <View style={styles.infoRow}>
                        <Ionicons
                          name="bulb-outline"
                          size={15}
                          color={tintColor}
                        />
                        <StyledText variant="bodyMedium">
                          Taillights:{" "}
                          {appointmentDetails.fleet_maintenance.taillights_status
                            .replace("_", " ")
                            .replace(/\b\w/g, (l: string) => l.toUpperCase())}
                        </StyledText>
                      </View>
                    )}
                    {appointmentDetails.fleet_maintenance.indicators_status && (
                      <View style={styles.infoRow}>
                        <Ionicons name="flash" size={15} color={tintColor} />
                        <StyledText variant="bodyMedium">
                          Indicators:{" "}
                          {appointmentDetails.fleet_maintenance.indicators_status
                            .replace("_", " ")
                            .replace(/\b\w/g, (l: string) => l.toUpperCase())}
                        </StyledText>
                      </View>
                    )}
                    {appointmentDetails.fleet_maintenance
                      .vehicle_condition_notes && (
                      <View style={styles.infoRow}>
                        <Ionicons name="document" size={15} color={tintColor} />
                        <StyledText variant="bodyMedium">
                          Condition Notes:{" "}
                          {
                            appointmentDetails.fleet_maintenance
                              .vehicle_condition_notes
                          }
                        </StyledText>
                      </View>
                    )}
                    {appointmentDetails.fleet_maintenance.damage_report && (
                      <View style={styles.infoRow}>
                        <Ionicons name="warning" size={15} color={tintColor} />
                        <StyledText variant="bodyMedium">
                          Damage Report:{" "}
                          {appointmentDetails.fleet_maintenance.damage_report}
                        </StyledText>
                      </View>
                    )}
                  </View>
                </View>
              )}
          </>
        )}

        {/* Action Buttons */}
        <View style={styles.actionButtonsContainer}>
          {renderActionButtons()}
        </View>
      </ScrollView>
    </View>
  );
};

export default AppointmentDetailsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    gap: 12,
  },
  headerBack: {
    padding: 4,
  },
  headerContent: {
    flex: 1,
  },
  headerRef: {
    opacity: 0.8,
    marginTop: 2,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
    borderWidth: 1.5,
    marginBottom: 24,
    gap: 8,
  },
  statusPillText: {
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  sectionCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.06)",
  },
  card: {
    borderRadius: 5,
    padding: 10,
    marginBottom: 5,
    borderWidth: 1,
    gap: 5,
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  statusPending: {
    backgroundColor: "#fff3cd",
    color: "#856404",
  },
  statusAccepted: {
    backgroundColor: "#d1ecf1",
    color: "#0c5460",
  },
  statusInProgress: {
    backgroundColor: "#d4edda",
    color: "#155724",
  },
  statusCompleted: {
    backgroundColor: "#c3e6cb",
    color: "#155724",
  },
  statusCancelled: {
    backgroundColor: "#f8d7da",
    color: "#721c24",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  infoContainer: {
    paddingHorizontal: 10,
    gap: 5,
  },
  descriptionContainer: {
    flex: 1,
    marginLeft: 10,
  },
  descriptionItem: {
    marginBottom: 2,
  },
  actionButtonsContainer: {
    marginTop: 24,
    marginBottom: 40,
  },
  buttonContainer: {
    gap: 12,
  },
  modernButtonContainer: {
    gap: 16,
    paddingHorizontal: 4,
  },
  sleekButtonContainer: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 4,
  },
  sleekActionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 0,
    gap: 8,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  modernActionButton: {
    padding: 0,
    borderRadius: 16,
    marginBottom: 0,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    width: "100%",
  },
  buttonIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  buttonTextContainer: {
    flex: 1,
  },
  sleekButtonText: {
    color: "white",
    fontWeight: "500",
    fontSize: 14,
  },
  modernButtonText: {
    color: "white",
    fontWeight: "600",
    fontSize: 16,
    marginBottom: 2,
  },
  modernButtonSubtext: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 13,
  },
  acceptButton: {
    backgroundColor: "#28a745",
  },
  modernAcceptButton: {
    backgroundColor: "#10B981",
  },
  sleekAcceptButton: {
    backgroundColor: "#10B981",
  },
  startButton: {
    backgroundColor: "#007bff",
  },
  completeButton: {
    backgroundColor: "#28a745",
  },
  cancelButton: {
    backgroundColor: "#dc3545",
  },
  modernCancelButton: {
    backgroundColor: "#EF4444",
  },
  sleekCancelButton: {
    backgroundColor: "#EF4444",
  },
  completedMessage: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 30,
  },
  completedMessageContainer: {
    gap: 12,
  },
  backToListButton: {
    marginTop: 8,
  },
  imageSection: {
    marginBottom: 16,
  },
  imageSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap:10
  },
  imageSectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  imageGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
  },
  imagePlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 8,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#ccc",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
  },
  uploadButton: {
    width: 120,
    height: 120,
    borderRadius: 8,
    borderWidth: 2,
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
  },
  imageContainer: {
    width: "32%",
    height: 100,
    borderRadius: 2,
    overflow: "hidden",
  },
  uploadedImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  removeButton: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderRadius: 12,
  },
  pickerContainer: {
    marginBottom: 16,
  },
  pickerOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  pickerOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: "transparent",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pickerOptionSelected: {
    backgroundColor: "#007bff", // Will be overridden by inline style
  },
  fleetMaintenanceForm: {
    marginTop: 12,
  },
  formInput: {
    marginBottom: 12,
  },
  successIndicator: {
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
    backgroundColor: "#d4edda",
    borderRadius: 8,
    marginBottom: 12,
  },
});
