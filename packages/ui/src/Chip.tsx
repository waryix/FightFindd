import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { theme } from "@fightfind/config";

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  color?: string;
  disabled?: boolean;
  accessibilityLabel?: string;
}

export function Chip({ label, selected = false, onPress, color, disabled, accessibilityLabel }: ChipProps) {
  const accent = color ?? theme.colors.primary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected, disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.chip,
        selected && { backgroundColor: accent, borderColor: accent },
        disabled && styles.disabled,
      ]}
    >
      <Text style={[styles.text, selected && styles.textSelected]}>{label}</Text>
    </Pressable>
  );
}

interface ChipRowProps<T extends string> {
  options: readonly T[];
  value: T | null;
  onChange: (value: T | null) => void;
  labels?: Partial<Record<T, string>>;
  colors?: Partial<Record<T, string>>;
  includeAll?: boolean;
  allLabel?: string;
  contentPadding?: number;
}

export function ChipRow<T extends string>({
  options,
  value,
  onChange,
  labels,
  colors,
  includeAll = false,
  allLabel = "All",
  contentPadding = 16,
}: ChipRowProps<T>) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroller}
      contentContainerStyle={[styles.row, { paddingHorizontal: contentPadding }]}
    >
      {includeAll ? (
        <Chip label={allLabel} selected={value === null} onPress={() => onChange(null)} />
      ) : null}
      {options.map((option) => (
        <Chip
          key={option}
          label={labels?.[option] ?? option.replace(/_/g, " ")}
          color={colors?.[option]}
          selected={value === option}
          onPress={() => onChange(value === option ? null : option)}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // Horizontal ScrollViews default to flexGrow: 1 in a column, which makes the
  // chip rows stretch/overlap and leaves big gaps when the list is short.
  scroller: { flexGrow: 0, flexShrink: 0, maxHeight: 44 },
  chip: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.surfaceRaised,
    borderWidth: 1,
    borderColor: theme.colors.border,
    minHeight: 30,
    flexShrink: 0,
    justifyContent: "center",
  },
  text: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  textSelected: { color: "#fff" },
  disabled: { opacity: 0.4 },
  row: { gap: 6, alignItems: "center", paddingVertical: 3 },
});
