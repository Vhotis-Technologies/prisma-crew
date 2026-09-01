/**
 * Job — where, when, vehicle, service, photos, fleet, complete. No prices.
 */
import { useEffect, useMemo, useState } from "react";
import {
  View,
  Pressable,
  ScrollView,
  RefreshControl,
  StyleSheet,
  Linking,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  JobDetailsProps,
  FleetMaintenanceProps,
  JobStatus,
} from "@/app/interfaces/AppointmentInterface";
import { useAppointment } from "@/app/app-hooks/useAppointment";
import { useGetAppointmentDetailsQuery } from "@/app/store/api/appointmentsApi";
import {
  captureMultipleCameraImages,
  prepareImagesForUpload,
  type ImageAlertHelpers,
} from "@/app/utils/images";
import { useAlertContext } from "@/app/contexts/AlertContext";
import { Screen, CrewText, PrimaryButton } from "@/app/components/ui/system";
import { PhotoStrip, type CapturedPhoto } from "@/app/components/ui/job/PhotoStrip";
import { FleetChecklist } from "@/app/components/ui/job/FleetChecklist";
import { useThemeTokens } from "@/hooks/useThemeTokens";
import { StatusTone } from "@/constants/theme";

const MAX_SEGMENT = 4;

const STATUS_LABEL: Record<JobStatus, string> = {
  pending: "Pending",
  accepted: "Assigned",
  in_progress: "In progress",
  completed: "Done",
  cancelled: "Cancelled",
};

function paramString(
  value: string | string[] | undefined,
): string | null {
  if (typeof value === "string" && value.trim()) return value;
  if (Array.isArray(value) && typeof value[0] === "string" && value[0].trim()) {
    return value[0];
  }
  return null;
}

function parseJob(params: Record<string, string | string[] | undefined>): JobDetailsProps | null {
  const raw = params.appointmentDetails;
  if (typeof raw !== "string") return null;
  try {
    return JSON.parse(raw) as JobDetailsProps;
  } catch {
    return null;
  }
}

function openMaps(address: string) {
  const q = encodeURIComponent(address);
  Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${q}`);
}

function callPhone(phone: string) {
  Linking.openURL(`tel:${phone}`);
}

export default function AppointmentDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { colors, spacing, radius } = useThemeTokens();
  const { setAlertConfig } = useAlertContext();
  const {
    handleCompleteAppointment,
    handleStartAppointment,
    handleUploadBeforeImages,
    handleUploadAfterImages,
    handleSubmitFleetMaintenance,
    isLoadingUploadBeforeImages,
    isLoadingUploadAfterImages,
    isLoadingSubmitFleetMaintenance,
  } = useAppointment();

  const fromParams = parseJob(params);
  const appointmentId =
    paramString(params.id) || (fromParams?.id ? String(fromParams.id) : null);

  const {
    data: fetched,
    isLoading,
    isError,
    refetch,
  } = useGetAppointmentDetailsQuery(
    { id: appointmentId },
    { skip: !appointmentId, refetchOnMountOrArgChange: true, refetchOnFocus: true },
  );

  const job = fetched ?? fromParams;

  const [beforeInt, setBeforeInt] = useState<CapturedPhoto[]>([]);
  const [beforeExt, setBeforeExt] = useState<CapturedPhoto[]>([]);
  const [afterInt, setAfterInt] = useState<CapturedPhoto[]>([]);
  const [afterExt, setAfterExt] = useState<CapturedPhoto[]>([]);
  const [fleet, setFleet] = useState<Partial<FleetMaintenanceProps>>({});
  const [tread, setTread] = useState("");
  const [fleetSaved, setFleetSaved] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [acting, setActing] = useState(false);

  useEffect(() => {
    if (job?.fleet_maintenance?.id) {
      setFleet(job.fleet_maintenance);
      setFleetSaved(true);
      setTread(
        job.fleet_maintenance.tire_tread_depth != null
          ? String(job.fleet_maintenance.tire_tread_depth)
          : "",
      );
    }
  }, [job?.fleet_maintenance]);

  const imageAlert: ImageAlertHelpers = {
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

  const capture = async (
    kind: "before" | "after",
    segment: "interior" | "exterior",
  ) => {
    const uploaded =
      kind === "before"
        ? segment === "interior"
          ? job?.before_images_interior?.length || 0
          : job?.before_images_exterior?.length || 0
        : segment === "interior"
          ? job?.after_images_interior?.length || 0
          : job?.after_images_exterior?.length || 0;
    const captured =
      kind === "before"
        ? segment === "interior"
          ? beforeInt.length
          : beforeExt.length
        : segment === "interior"
          ? afterInt.length
          : afterExt.length;
    const remaining = MAX_SEGMENT - uploaded - captured;
    if (remaining <= 0) {
      imageAlert.showAlert(
        "Photo limit",
        `You already have ${MAX_SEGMENT} ${segment} ${kind} photos.`,
      );
      return;
    }
    const images = await captureMultipleCameraImages(remaining, imageAlert);
    if (!images.length) return;
    if (kind === "before" && segment === "interior") {
      setBeforeInt((prev) => [...prev, ...images]);
    } else if (kind === "before") {
      setBeforeExt((prev) => [...prev, ...images]);
    } else if (segment === "interior") {
      setAfterInt((prev) => [...prev, ...images]);
    } else {
      setAfterExt((prev) => [...prev, ...images]);
    }
  };

  const beforeIntTotal =
    (job?.before_images_interior?.length || 0) + beforeInt.length;
  const beforeExtTotal =
    (job?.before_images_exterior?.length || 0) + beforeExt.length;
  const afterIntTotal =
    (job?.after_images_interior?.length || 0) + afterInt.length;
  const afterExtTotal =
    (job?.after_images_exterior?.length || 0) + afterExt.length;

  const canStart =
    job?.status === "accepted" &&
    beforeIntTotal >= MAX_SEGMENT &&
    beforeExtTotal >= MAX_SEGMENT;
  const canComplete =
    job?.status === "in_progress" &&
    afterIntTotal >= MAX_SEGMENT &&
    afterExtTotal >= MAX_SEGMENT &&
    fleetSaved;

  const startJob = async () => {
    if (!job?.id) return;
    setActing(true);
    try {
      if (beforeInt.length) {
        await handleUploadBeforeImages(
          prepareImagesForUpload(beforeInt, String(job.id), "interior"),
        );
      }
      if (beforeExt.length) {
        await handleUploadBeforeImages(
          prepareImagesForUpload(beforeExt, String(job.id), "exterior"),
        );
      }
      await handleStartAppointment(String(job.id));
      setBeforeInt([]);
      setBeforeExt([]);
      await refetch();
    } catch (error) {
      console.error("Error starting job:", error);
    } finally {
      setActing(false);
    }
  };

  const completeJob = async () => {
    if (!job?.id) return;
    setActing(true);
    try {
      if (afterInt.length) {
        await handleUploadAfterImages(
          prepareImagesForUpload(afterInt, String(job.id), "interior"),
        );
      }
      if (afterExt.length) {
        await handleUploadAfterImages(
          prepareImagesForUpload(afterExt, String(job.id), "exterior"),
        );
      }
      await handleCompleteAppointment(String(job.id));
      setAfterInt([]);
      setAfterExt([]);
      await refetch();
      router.back();
    } catch (error) {
      console.error("Error completing job:", error);
    } finally {
      setActing(false);
    }
  };

  const saveFleet = async () => {
    if (!job?.id) return;
    try {
      const treadNum = parseFloat(tread);
      await handleSubmitFleetMaintenance(String(job.id), {
        ...fleet,
        tire_tread_depth:
          tread.trim() === "" || Number.isNaN(treadNum) ? undefined : treadNum,
      });
      setFleetSaved(true);
      await refetch();
    } catch (error) {
      console.error("Error submitting fleet check:", error);
    }
  };

  const plate = job?.vehicle_license || job?.vehiclie_license || "";
  const note = job?.specialInstruction || job?.special_instruction || "";
  const address = [job?.address, job?.city, job?.post_code]
    .filter(Boolean)
    .join(", ");
  const vehicle = [job?.vehicle_color, job?.vehicle_year, job?.vehicle_make, job?.vehicle_model]
    .filter(Boolean)
    .join(" ");
  const serviceName = job?.service_type?.name || "Job";
  const steps = (() => {
    const desc = job?.service_type?.description as unknown;
    if (Array.isArray(desc)) return desc.filter((item) => typeof item === "string");
    if (desc && typeof desc === "object") {
      return Object.values(desc).filter((item): item is string => typeof item === "string");
    }
    return typeof desc === "string" && desc ? [desc] : [];
  })();
  const status = (job?.status || "pending") as JobStatus;
  const isClosed = status === "completed" || status === "cancelled";
  const toneKey = StatusTone[status];
  const statusFg =
    toneKey === "primary"
      ? colors.primary
      : toneKey === "success"
        ? colors.success
        : toneKey === "error"
          ? colors.error
          : colors.warning;

  const ctaHint = useMemo(() => {
    if (status === "accepted" && !canStart) {
      return `Take ${MAX_SEGMENT} interior and ${MAX_SEGMENT} exterior before photos to start.`;
    }
    if (status === "in_progress" && !canComplete) {
      if (!fleetSaved) return "Save the fleet check, then take after photos.";
      return `Take ${MAX_SEGMENT} interior and ${MAX_SEGMENT} exterior after photos to complete.`;
    }
    return "";
  }, [status, canStart, canComplete, fleetSaved]);

  const footer = isClosed ? (
    <PrimaryButton label="Go back" variant="secondary" onPress={() => router.back()} />
  ) : status === "accepted" ? (
      <View style={{ gap: spacing.xs }}>
        {ctaHint ? <CrewText variant="caption" muted>{ctaHint}</CrewText> : null}
        <PrimaryButton
          label="Start job"
          disabled={!canStart}
          loading={acting || isLoadingUploadBeforeImages}
          onPress={startJob}
        />
      </View>
    ) : status === "in_progress" ? (
      <View style={{ gap: spacing.xs }}>
        {ctaHint ? <CrewText variant="caption" muted>{ctaHint}</CrewText> : null}
        <PrimaryButton
          label="Complete job"
          disabled={!canComplete}
          loading={
            acting ||
            isLoadingUploadAfterImages ||
            isLoadingSubmitFleetMaintenance
          }
          onPress={completeJob}
        />
      </View>
    ) : null;

  if (!appointmentId) {
    return (
      <Screen padded edges={["top"]}>
        <CrewText variant="title">Job not found</CrewText>
        <PrimaryButton label="Go back" onPress={() => router.back()} />
      </Screen>
    );
  }

  if (isError && !job) {
    return (
      <Screen padded edges={["top"]}>
        <CrewText variant="title">Job not found</CrewText>
        <PrimaryButton label="Go back" onPress={() => router.back()} />
      </Screen>
    );
  }

  if (isLoading && !job) {
    return (
      <Screen padded edges={["top"]}>
        <ActivityIndicator color={colors.button} />
      </Screen>
    );
  }

  return (
    <Screen padded={false} edges={["top"]} footer={footer}>
      <ScrollView
        contentContainerStyle={{
          padding: spacing.md,
          paddingBottom: spacing.xl,
          gap: spacing.md,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              try {
                await refetch();
              } finally {
                setRefreshing(false);
              }
            }}
            tintColor={colors.button}
          />
        }
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            accessibilityLabel="Back"
            style={[
              styles.iconBtn,
              { borderColor: colors.borders, backgroundColor: colors.cards },
            ]}
          >
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <CrewText variant="caption" muted>
              #{job?.booking_reference}
            </CrewText>
            <CrewText variant="title">{serviceName}</CrewText>
          </View>
        </View>

        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.cards,
              borderColor:
                status === "cancelled"
                  ? colors.error
                  : status === "completed"
                    ? colors.success
                    : colors.primary,
              borderRadius: radius.md,
              padding: spacing.lg,
              gap: spacing.xs,
            },
          ]}
        >
          <CrewText variant="caption" color={statusFg}>
            {STATUS_LABEL[status]}
          </CrewText>
          <CrewText variant="display">
            {job?.appointment_time}
            {job?.duration ? ` · ${job.duration} min` : ""}
          </CrewText>
          {job?.appointment_date ? (
            <CrewText variant="body" muted>
              {job.appointment_date}
            </CrewText>
          ) : null}
          <CrewText variant="subtitle">{job?.post_code || address}</CrewText>
          <CrewText variant="body" muted>
            {vehicle}
            {plate ? ` · ${plate}` : ""}
          </CrewText>
          <CrewText variant="body" muted>
            {job?.client_name}
            {job?.valet_type || job?.valetType ? ` · ${job.valet_type || job.valetType}` : ""}
          </CrewText>
          {address ? (
            <CrewText variant="caption" muted>
              {address}
            </CrewText>
          ) : null}

          {isClosed ? null : (
          <View style={{ flexDirection: "row", gap: spacing.xs, marginTop: spacing.sm }}>
            {address ? (
              <PrimaryButton
                label="Navigate"
                variant="secondary"
                fullWidth={false}
                onPress={() => openMaps(address)}
              />
            ) : null}
            {job?.client_phone ? (
              <PrimaryButton
                label="Call"
                variant="secondary"
                fullWidth={false}
                onPress={() => callPhone(job.client_phone)}
              />
            ) : null}
          </View>
          )}
        </View>

        {status === "cancelled" ? (
          <View
            style={[
              styles.card,
              {
                backgroundColor: colors.errorBg,
                borderColor: colors.error,
                borderRadius: radius.md,
                padding: spacing.md,
                gap: 4,
              },
            ]}
          >
            <CrewText variant="subtitle">Cancelled</CrewText>
            <CrewText variant="body" muted>
              This job was cancelled. No start, photos, or fleet check are needed.
            </CrewText>
          </View>
        ) : null}

        {status === "completed" ? (
          <View
            style={[
              styles.card,
              {
                backgroundColor: colors.successBg,
                borderColor: colors.success,
                borderRadius: radius.md,
                padding: spacing.md,
                gap: 4,
              },
            ]}
          >
            <CrewText variant="subtitle">Completed</CrewText>
            <CrewText variant="body" muted>
              This job is finished. Photos are not shown in history.
            </CrewText>
          </View>
        ) : null}

        {note ? (
          <View
            style={[
              styles.card,
              {
                backgroundColor: colors.warningBg,
                borderColor: colors.warning,
                borderRadius: radius.md,
                padding: spacing.md,
                gap: 4,
              },
            ]}
          >
            <CrewText variant="label">Owner note</CrewText>
            <CrewText variant="body">{note}</CrewText>
          </View>
        ) : null}

        {steps.length > 0 ? (
          <View
            style={[
              styles.card,
              {
                backgroundColor: colors.cards,
                borderColor: colors.borders,
                borderRadius: radius.md,
                padding: spacing.md,
                gap: spacing.xs,
              },
            ]}
          >
            <CrewText variant="subtitle">What to do</CrewText>
            {steps.map((step, index) => (
              <CrewText key={`${index}-${step}`} variant="body">
                • {step}
              </CrewText>
            ))}
          </View>
        ) : null}

        {job?.addons && job.addons.length > 0 ? (
          <View
            style={[
              styles.card,
              {
                backgroundColor: colors.cards,
                borderColor: colors.borders,
                borderRadius: radius.md,
                padding: spacing.md,
                gap: spacing.xs,
              },
            ]}
          >
            <CrewText variant="subtitle">Add-ons</CrewText>
            {job.addons.map((addon) => (
              <CrewText key={addon} variant="body">
                • {addon}
              </CrewText>
            ))}
          </View>
        ) : null}

        {!isClosed &&
          (status === "accepted" || status === "in_progress") && (
          <View
            style={[
              styles.card,
              {
                backgroundColor: colors.cards,
                borderColor: colors.borders,
                borderRadius: radius.md,
                padding: spacing.md,
                gap: spacing.md,
              },
            ]}
          >
            <CrewText variant="subtitle">
              {status === "in_progress" ? "After photos" : "Before photos"}
            </CrewText>
            {status === "accepted" ? (
              <>
                <PhotoStrip
                  title="Interior"
                  required={MAX_SEGMENT}
                  uploaded={job?.before_images_interior || []}
                  captured={beforeInt}
                  onAdd={() => capture("before", "interior")}
                  onRemoveCaptured={(i) =>
                    setBeforeInt((prev) => prev.filter((_, idx) => idx !== i))
                  }
                />
                <PhotoStrip
                  title="Exterior"
                  required={MAX_SEGMENT}
                  uploaded={job?.before_images_exterior || []}
                  captured={beforeExt}
                  onAdd={() => capture("before", "exterior")}
                  onRemoveCaptured={(i) =>
                    setBeforeExt((prev) => prev.filter((_, idx) => idx !== i))
                  }
                />
              </>
            ) : null}
            {status === "in_progress" ? (
              <>
                <PhotoStrip
                  title="Interior"
                  required={MAX_SEGMENT}
                  uploaded={job?.after_images_interior || []}
                  captured={afterInt}
                  onAdd={() => capture("after", "interior")}
                  onRemoveCaptured={(i) =>
                    setAfterInt((prev) => prev.filter((_, idx) => idx !== i))
                  }
                />
                <PhotoStrip
                  title="Exterior"
                  required={MAX_SEGMENT}
                  uploaded={job?.after_images_exterior || []}
                  captured={afterExt}
                  onAdd={() => capture("after", "exterior")}
                  onRemoveCaptured={(i) =>
                    setAfterExt((prev) => prev.filter((_, idx) => idx !== i))
                  }
                />
              </>
            ) : null}
          </View>
        )}

        {status === "in_progress" ? (
          <FleetChecklist
            value={fleet}
            tread={tread}
            onChange={setFleet}
            onTreadChange={setTread}
            onSubmit={saveFleet}
            submitted={fleetSaved}
            loading={isLoadingSubmitFleetMaintenance}
          />
        ) : null}

        {status === "completed" && job?.fleet_maintenance ? (
          <View
            style={[
              styles.card,
              {
                backgroundColor: colors.cards,
                borderColor: colors.borders,
                borderRadius: radius.md,
                padding: spacing.md,
                gap: 4,
              },
            ]}
          >
            <CrewText variant="subtitle">Fleet check</CrewText>
            {job.fleet_maintenance.vehicle_condition_notes ? (
              <CrewText variant="body">
                {job.fleet_maintenance.vehicle_condition_notes}
              </CrewText>
            ) : null}
            {job.fleet_maintenance.damage_report ? (
              <CrewText variant="body" muted>
                {job.fleet_maintenance.damage_report}
              </CrewText>
            ) : (
              <CrewText variant="body" muted>
                Fleet inspection was saved on this job.
              </CrewText>
            )}
          </View>
        ) : null}

        {status === "pending" ? (
          <CrewText variant="body" muted>
            This job is assigned. Start becomes available once it is accepted.
          </CrewText>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    borderWidth: 1,
  },
});
