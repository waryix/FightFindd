import { StyleSheet, View } from "react-native";
import { BottomSheet, Button, Chip, Input, AppText } from "@fightfind/ui";
import { theme } from "@fightfind/config";
import {
  DISCIPLINES,
  RADIUS_OPTIONS_KM,
  SKILL_LEVELS,
  WEIGHT_CLASSES,
  type Discipline,
  type SkillLevel,
  type WeightClass,
  type DiscoverySort,
} from "@fightfind/types";

export interface DiscoverFiltersState {
  discipline: Discipline | null;
  skill: SkillLevel | null;
  weightClass: WeightClass | null;
  city: string;
  radiusKm: number | null;
  minHeight: string;
  maxHeight: string;
  minWeight: string;
  maxWeight: string;
  minExperience: string;
  maxExperience: string;
  minFights: string;
  maxFights: string;
  sort: DiscoverySort;
}

export const DEFAULT_DISCOVER_FILTERS: DiscoverFiltersState = {
  discipline: null,
  skill: null,
  weightClass: null,
  city: "",
  radiusKm: 25,
  minHeight: "",
  maxHeight: "",
  minWeight: "",
  maxWeight: "",
  minExperience: "",
  maxExperience: "",
  minFights: "",
  maxFights: "",
  sort: "best_match",
};

export function countActiveFilters(filters: DiscoverFiltersState): number {
  let count = 0;
  if (filters.skill) count += 1;
  if (filters.weightClass) count += 1;
  if (filters.city) count += 1;
  for (const key of [
    "minHeight",
    "maxHeight",
    "minWeight",
    "maxWeight",
    "minExperience",
    "maxExperience",
    "minFights",
    "maxFights",
  ] as const) {
    if (filters[key]) count += 1;
  }
  return count;
}

interface Props {
  visible: boolean;
  filters: DiscoverFiltersState;
  isPremium: boolean;
  onChange: (next: DiscoverFiltersState) => void;
  onClose: () => void;
  onUpgrade: () => void;
}

export function DiscoverFilters({ visible, filters, isPremium, onChange, onClose, onUpgrade }: Props) {
  const update = <K extends keyof DiscoverFiltersState>(key: K, value: DiscoverFiltersState[K]) =>
    onChange({ ...filters, [key]: value });

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Filters"
      footer={
        <View style={styles.footer}>
          <Button title="Clear all" variant="secondary" size="sm" fullWidth={false} style={styles.footerButton} onPress={() => onChange({ ...DEFAULT_DISCOVER_FILTERS, sort: filters.sort })} />
          <Button title="Apply" size="sm" fullWidth={false} style={styles.footerButton} onPress={onClose} />
        </View>
      }
    >
      <AppText variant="label">Location</AppText>
      <Input label="City" placeholder="e.g. Bengaluru" value={filters.city} onChangeText={(value) => update("city", value)} />
      <AppText variant="caption">Radius (applies when your location is on)</AppText>
      <View style={styles.chips}>
        {RADIUS_OPTIONS_KM.map((radius) => (
          <Chip key={radius} label={`${radius} km`} selected={filters.radiusKm === radius} onPress={() => update("radiusKm", radius)} />
        ))}
        <Chip label="Anywhere" selected={filters.radiusKm === null} onPress={() => update("radiusKm", null)} />
      </View>

      <AppText variant="label">Discipline</AppText>
      <View style={styles.chips}>
        {DISCIPLINES.map((discipline) => (
          <Chip
            key={discipline}
            label={discipline.replace(/_/g, " ")}
            selected={filters.discipline === discipline}
            onPress={() => update("discipline", filters.discipline === discipline ? null : discipline)}
          />
        ))}
      </View>

      <AppText variant="label">Skill</AppText>
      <View style={styles.chips}>
        {SKILL_LEVELS.map((skill) => (
          <Chip key={skill} label={skill} selected={filters.skill === skill} onPress={() => update("skill", filters.skill === skill ? null : skill)} />
        ))}
      </View>

      <AppText variant="label">Weight Class</AppText>
      <View style={styles.chips}>
        {WEIGHT_CLASSES.map((weightClass) => (
          <Chip
            key={weightClass}
            label={weightClass.replace(/_/g, " ")}
            selected={filters.weightClass === weightClass}
            onPress={() => update("weightClass", filters.weightClass === weightClass ? null : weightClass)}
          />
        ))}
      </View>

      <View style={styles.advancedHeader}>
        <AppText variant="label">Advanced filters</AppText>
        {!isPremium ? (
          <Chip label="Pro" selected onPress={onUpgrade} />
        ) : null}
      </View>
      {!isPremium ? (
        <AppText variant="caption" color={theme.colors.textMuted}>
          Advanced filters are part of FightFind Pro. Tap the Pro chip to upgrade.
        </AppText>
      ) : null}

      <View style={styles.rangeRow}>
        <View style={styles.rangeHalf}>
          <Input label="Min height (cm)" keyboardType="number-pad" editable={isPremium} value={filters.minHeight} onChangeText={(value) => update("minHeight", value)} />
        </View>
        <View style={styles.rangeHalf}>
          <Input label="Max height (cm)" keyboardType="number-pad" editable={isPremium} value={filters.maxHeight} onChangeText={(value) => update("maxHeight", value)} />
        </View>
      </View>
      <View style={styles.rangeRow}>
        <View style={styles.rangeHalf}>
          <Input label="Min weight (kg)" keyboardType="decimal-pad" editable={isPremium} value={filters.minWeight} onChangeText={(value) => update("minWeight", value)} />
        </View>
        <View style={styles.rangeHalf}>
          <Input label="Max weight (kg)" keyboardType="decimal-pad" editable={isPremium} value={filters.maxWeight} onChangeText={(value) => update("maxWeight", value)} />
        </View>
      </View>
      <View style={styles.rangeRow}>
        <View style={styles.rangeHalf}>
          <Input label="Min years exp" keyboardType="number-pad" editable={isPremium} value={filters.minExperience} onChangeText={(value) => update("minExperience", value)} />
        </View>
        <View style={styles.rangeHalf}>
          <Input label="Max years exp" keyboardType="number-pad" editable={isPremium} value={filters.maxExperience} onChangeText={(value) => update("maxExperience", value)} />
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  advancedHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 },
  rangeRow: { flexDirection: "row", gap: 10 },
  rangeHalf: { flex: 1, minWidth: 0 },
  footer: { flexDirection: "row", gap: 10 },
  footerButton: { flex: 1 },
});
