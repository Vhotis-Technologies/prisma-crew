/**
 * Fleet checklist — compact chips, large taps. Required before Complete.
 */
import { View, Pressable, TextInput, StyleSheet } from "react-native";
import type { FleetMaintenanceProps } from "@/app/interfaces/AppointmentInterface";
import { useThemeTokens } from "@/hooks/useThemeTokens";
import { CrewText, PrimaryButton } from "@/app/components/ui/system";

type Option = { label: string; value: string };

const WIPER: Option[] = [
  { label: "Good", value: "good" },
  { label: "Needs work", value: "needs_work" },
  { label: "Bad", value: "bad" },
];
const FLUID: Option[] = [
  { label: "Good", value: "good" },
  { label: "Low", value: "low" },
  { label: "Needs refill", value: "needs_refill" },
];
const BATTERY: Option[] = [
  { label: "Good", value: "good" },
  { label: "Weak", value: "weak" },
  { label: "Replace", value: "replace" },
];
const LIGHT: Option[] = [
  { label: "Working", value: "working" },
  { label: "Dim", value: "dim" },
  { label: "Not working", value: "not_working" },
];
const INDICATOR: Option[] = [
  { label: "Working", value: "working" },
  { label: "Not working", value: "not_working" },
];

type FleetChecklistProps = {
  value: Partial<FleetMaintenanceProps>;
  tread: string;
  onChange: (next: Partial<FleetMaintenanceProps>) => void;
  onTreadChange: (text: string) => void;
  onSubmit: () => void;
  submitted: boolean;
  loading?: boolean;
};

export function FleetChecklist({
  value,
  tread,
  onChange,
  onTreadChange,
  onSubmit,
  submitted,
  loading,
}: FleetChecklistProps) {
  const { colors, radius, spacing } = useThemeTokens();

  if (submitted) {
    return (
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.successBg,
            borderColor: colors.success,
            borderRadius: radius.md,
            padding: spacing.md,
          },
        ]}
      >
        <CrewText variant="subtitle">Fleet check saved</CrewText>
        <CrewText variant="caption" muted>
          You can complete the job once after photos are in.
        </CrewText>
      </View>
    );
  }

  return (
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
      <CrewText variant="subtitle">Fleet check</CrewText>
      <CrewText variant="caption" muted>
        Required before you can complete this job.
      </CrewText>

      <CrewText variant="label">Tyre tread (mm)</CrewText>
      <TextInput
        value={tread}
        onChangeText={onTreadChange}
        keyboardType="decimal-pad"
        placeholder="e.g. 4.5"
        placeholderTextColor={colors.muted}
        style={[
          styles.input,
          {
            borderColor: colors.borders,
            color: colors.text,
            borderRadius: radius.md,
            backgroundColor: colors.canvas,
          },
        ]}
      />

      <CrewText variant="label">Tyre condition</CrewText>
      <TextInput
        value={value.tire_condition || ""}
        onChangeText={(text) => onChange({ ...value, tire_condition: text })}
        placeholder="Cuts, wear, pressure…"
        placeholderTextColor={colors.muted}
        style={[
          styles.input,
          {
            borderColor: colors.borders,
            color: colors.text,
            borderRadius: radius.md,
            backgroundColor: colors.canvas,
          },
        ]}
      />

      <ChipRow
        label="Wipers"
        options={WIPER}
        selected={value.wiper_status}
        onSelect={(v) => onChange({ ...value, wiper_status: v as FleetMaintenanceProps["wiper_status"] })}
      />
      <ChipRow
        label="Oil"
        options={FLUID}
        selected={value.oil_level}
        onSelect={(v) => onChange({ ...value, oil_level: v as FleetMaintenanceProps["oil_level"] })}
      />
      <ChipRow
        label="Coolant"
        options={FLUID}
        selected={value.coolant_level}
        onSelect={(v) => onChange({ ...value, coolant_level: v as FleetMaintenanceProps["coolant_level"] })}
      />
      <ChipRow
        label="Brake fluid"
        options={FLUID}
        selected={value.brake_fluid_level}
        onSelect={(v) =>
          onChange({
            ...value,
            brake_fluid_level: v as FleetMaintenanceProps["brake_fluid_level"],
          })
        }
      />
      <ChipRow
        label="Battery"
        options={BATTERY}
        selected={value.battery_condition}
        onSelect={(v) =>
          onChange({
            ...value,
            battery_condition: v as FleetMaintenanceProps["battery_condition"],
          })
        }
      />
      <ChipRow
        label="Headlights"
        options={LIGHT}
        selected={value.headlights_status}
        onSelect={(v) =>
          onChange({
            ...value,
            headlights_status: v as FleetMaintenanceProps["headlights_status"],
          })
        }
      />
      <ChipRow
        label="Taillights"
        options={LIGHT}
        selected={value.taillights_status}
        onSelect={(v) =>
          onChange({
            ...value,
            taillights_status: v as FleetMaintenanceProps["taillights_status"],
          })
        }
      />
      <ChipRow
        label="Indicators"
        options={INDICATOR}
        selected={value.indicators_status}
        onSelect={(v) =>
          onChange({
            ...value,
            indicators_status: v as FleetMaintenanceProps["indicators_status"],
          })
        }
      />

      <CrewText variant="label">Notes (optional)</CrewText>
      <TextInput
        value={value.vehicle_condition_notes || ""}
        onChangeText={(text) =>
          onChange({ ...value, vehicle_condition_notes: text })
        }
        placeholder="Condition"
        placeholderTextColor={colors.muted}
        multiline
        style={[
          styles.input,
          styles.multiline,
          {
            borderColor: colors.borders,
            color: colors.text,
            borderRadius: radius.md,
            backgroundColor: colors.canvas,
          },
        ]}
      />
      <TextInput
        value={value.damage_report || ""}
        onChangeText={(text) => onChange({ ...value, damage_report: text })}
        placeholder="Damage"
        placeholderTextColor={colors.muted}
        multiline
        style={[
          styles.input,
          styles.multiline,
          {
            borderColor: colors.borders,
            color: colors.text,
            borderRadius: radius.md,
            backgroundColor: colors.canvas,
          },
        ]}
      />

      <PrimaryButton
        label="Save fleet check"
        loading={loading}
        onPress={onSubmit}
      />
    </View>
  );
}

function ChipRow({
  label,
  options,
  selected,
  onSelect,
}: {
  label: string;
  options: Option[];
  selected?: string;
  onSelect: (value: string) => void;
}) {
  const { colors, radius, spacing, tap } = useThemeTokens();
  return (
    <View style={{ gap: spacing.xs }}>
      <CrewText variant="label">{label}</CrewText>
      <View style={styles.chips}>
        {options.map((option) => {
          const on = selected === option.value;
          return (
            <Pressable
              key={option.value}
              onPress={() => onSelect(option.value)}
              style={({ pressed }) => [
                styles.chip,
                {
                  minHeight: tap.min,
                  borderRadius: radius.md,
                  backgroundColor: on ? colors.primary : colors.canvas,
                  borderColor: on ? colors.primary : colors.borders,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <CrewText
                variant="caption"
                color={on ? colors.buttonText : colors.text}
              >
                {option.label}
              </CrewText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
  },
  input: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    minHeight: 48,
  },
  multiline: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
