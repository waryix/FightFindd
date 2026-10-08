import { StyleSheet, View } from "react-native";
import { BottomSheet, Button, Chip, Input, AppText } from "@fightfind/ui";

export interface GymFiltersState {
  city: string;
  trialOnly: boolean;
  verifiedOnly: boolean;
  maxFeeRupees: string;
}

export const DEFAULT_GYM_FILTERS: GymFiltersState = {
  city: "",
  trialOnly: false,
  verifiedOnly: false,
  maxFeeRupees: "",
};

export function countGymFilters(filters: GymFiltersState): number {
  let count = 0;
  if (filters.city) count += 1;
  if (filters.trialOnly) count += 1;
  if (filters.verifiedOnly) count += 1;
  if (filters.maxFeeRupees) count += 1;
  return count;
}

interface Props {
  visible: boolean;
  filters: GymFiltersState;
  onChange: (next: GymFiltersState) => void;
  onClose: () => void;
}

export function GymFilters({ visible, filters, onChange, onClose }: Props) {
  const update = <K extends keyof GymFiltersState>(key: K, value: GymFiltersState[K]) =>
    onChange({ ...filters, [key]: value });

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Filters"
      footer={
        <View style={styles.footer}>
          <Button title="Clear all" variant="secondary" size="sm" style={styles.footerButton} onPress={() => onChange(DEFAULT_GYM_FILTERS)} />
          <Button title="Apply" size="sm" style={styles.footerButton} onPress={onClose} />
        </View>
      }
    >
      <AppText variant="label">Location</AppText>
      <Input label="City" placeholder="e.g. Bengaluru" value={filters.city} onChangeText={(value) => update("city", value)} />

      <AppText variant="label">Membership</AppText>
      <Input
        label="Max monthly fee (₹)"
        placeholder="e.g. 5000"
        keyboardType="number-pad"
        value={filters.maxFeeRupees}
        onChangeText={(value) => update("maxFeeRupees", value.replace(/[^\d]/g, ""))}
      />

      <AppText variant="label">Options</AppText>
      <View style={styles.chips}>
        <Chip label="Free trial" selected={filters.trialOnly} onPress={() => update("trialOnly", !filters.trialOnly)} />
        <Chip label="Verified only" selected={filters.verifiedOnly} onPress={() => update("verifiedOnly", !filters.verifiedOnly)} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  footer: { flexDirection: "row", gap: 10 },
  footerButton: { flex: 1 },
});
