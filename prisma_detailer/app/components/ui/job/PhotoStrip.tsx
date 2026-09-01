/**
 * Job photo strip — uploaded + local captures. 4 per interior/exterior segment.
 */
import { View, Pressable, Image, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeTokens } from "@/hooks/useThemeTokens";
import { CrewText } from "@/app/components/ui/system";

export type CapturedPhoto = { uri: string; type: string; filename: string };
export type UploadedPhoto = { id: number; image_url: string };

type PhotoStripProps = {
  title: string;
  required: number;
  uploaded: UploadedPhoto[];
  captured: CapturedPhoto[];
  onAdd?: () => void;
  onRemoveCaptured?: (index: number) => void;
};

export function PhotoStrip({
  title,
  required,
  uploaded,
  captured,
  onAdd,
  onRemoveCaptured,
}: PhotoStripProps) {
  const { colors, radius, spacing, tap } = useThemeTokens();
  const total = uploaded.length + captured.length;
  const remaining = Math.max(0, required - total);
  const canAdd = Boolean(onAdd) && remaining > 0;

  return (
    <View style={{ gap: spacing.xs }}>
      <CrewText variant="label">
        {title} · {total}/{required}
      </CrewText>
      <View style={styles.row}>
        {uploaded.map((photo) => (
          <Image
            key={`up-${photo.id}`}
            source={{ uri: photo.image_url }}
            style={[
              styles.thumb,
              { borderRadius: radius.md, backgroundColor: colors.canvas },
            ]}
          />
        ))}
        {captured.map((photo, index) => (
          <View key={`cap-${photo.uri}-${index}`} style={styles.thumbWrap}>
            <Image
              source={{ uri: photo.uri }}
              style={[
                styles.thumb,
                { borderRadius: radius.md, backgroundColor: colors.canvas },
              ]}
            />
            {onRemoveCaptured ? (
              <Pressable
                onPress={() => onRemoveCaptured(index)}
                accessibilityLabel="Remove photo"
                style={[styles.remove, { backgroundColor: colors.error }]}
              >
                <Ionicons name="close" size={12} color={colors.buttonText} />
              </Pressable>
            ) : null}
          </View>
        ))}
        {canAdd ? (
          <Pressable
            onPress={onAdd}
            accessibilityLabel={`Add ${title} photo`}
            style={({ pressed }) => [
              styles.add,
              {
                minHeight: tap.min,
                minWidth: tap.min,
                borderRadius: radius.md,
                borderColor: colors.borders,
                backgroundColor: colors.canvas,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Ionicons name="camera-outline" size={22} color={colors.button} />
            <CrewText variant="caption" muted>
              {remaining} left
            </CrewText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  thumb: {
    width: 72,
    height: 72,
  },
  thumbWrap: {
    position: "relative",
  },
  remove: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  add: {
    width: 72,
    height: 72,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
});
