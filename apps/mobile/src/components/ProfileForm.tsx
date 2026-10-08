import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, Chip, Input, TextArea, AppText } from "@fightfind/ui";
import { theme } from "@fightfind/config";
import {
  DISCIPLINES,
  SKILL_LEVELS,
  WEIGHT_CLASSES,
  WEIGHT_CLASS_RANGE_LABELS,
  suggestWeightClass,
  type Discipline,
  type FighterProfile,
  type SkillLevel,
  type WeightClass,
} from "@fightfind/types";
import { useDeviceLocation } from "../location/use-location";

export interface ProfileFormValues {
  name: string;
  city: string;
  state: string;
  ageYears: string;
  heightCm: string;
  weightKg: string;
  yearsExperience: string;
  totalAmateurFights: string;
  totalProFights: string;
  bio: string;
  disciplines: Discipline[];
  skillLevel: SkillLevel | null;
  weightClass: WeightClass | null;
  latitude: number | null;
  longitude: number | null;
}

export function profileToFormValues(profile: FighterProfile | null, fallbackName: string): ProfileFormValues {
  return {
    name: profile?.name ?? fallbackName,
    city: profile?.city ?? "",
    state: profile?.state ?? "",
    ageYears: profile?.ageYears ? String(profile.ageYears) : "",
    heightCm: profile?.heightCm ? String(profile.heightCm) : "",
    weightKg: profile?.weightKg ? String(profile.weightKg) : "",
    yearsExperience: profile ? String(profile.yearsExperience) : "",
    totalAmateurFights: profile ? String(profile.totalAmateurFights) : "",
    totalProFights: profile ? String(profile.totalProFights) : "",
    bio: profile?.bio ?? "",
    disciplines: profile?.disciplines ?? [],
    skillLevel: profile?.skillLevel ?? null,
    weightClass: profile?.weightClass ?? null,
    latitude: profile?.latitude ?? null,
    longitude: profile?.longitude ?? null,
  };
}

export function serializeProfile(values: ProfileFormValues) {
  return {
    name: values.name.trim(),
    city: values.city.trim(),
    state: values.state.trim(),
    ageYears: values.ageYears ? Number.parseInt(values.ageYears, 10) : null,
    heightCm: values.heightCm ? Number.parseFloat(values.heightCm) : null,
    weightKg: values.weightKg ? Number.parseFloat(values.weightKg) : null,
    yearsExperience: values.yearsExperience ? Number.parseInt(values.yearsExperience, 10) : 0,
    totalAmateurFights: values.totalAmateurFights ? Number.parseInt(values.totalAmateurFights, 10) : 0,
    totalProFights: values.totalProFights ? Number.parseInt(values.totalProFights, 10) : 0,
    bio: values.bio.trim() || null,
    disciplines: values.disciplines,
    skillLevel: values.skillLevel!,
    weightClass: values.weightClass!,
    latitude: values.latitude,
    longitude: values.longitude,
  };
}

interface Props {
  initial: ProfileFormValues;
  submitLabel: string;
  loading?: boolean;
  onSubmit: (values: ProfileFormValues) => void;
}

export function ProfileForm({ initial, submitLabel, loading, onSubmit }: Props) {
  const [values, setValues] = useState<ProfileFormValues>(initial);
  const [showErrors, setShowErrors] = useState(false);
  const location = useDeviceLocation();

  const update = <K extends keyof ProfileFormValues>(key: K, value: ProfileFormValues[K]) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const suggested = useMemo(() => {
    const weight = Number.parseFloat(values.weightKg);
    return Number.isFinite(weight) && weight > 0 ? suggestWeightClass(weight) : null;
  }, [values.weightKg]);

  const errors = {
    name: values.name.trim().length < 2 ? "Enter your full name" : null,
    location: !values.city.trim() || !values.state.trim() ? "City and state are required" : null,
    disciplines: values.disciplines.length === 0 ? "Pick at least one discipline" : null,
    skill: !values.skillLevel ? "Pick your skill level" : null,
    weightClass: !values.weightClass ? "Pick your weight class" : null,
  };
  const hasErrors = Object.values(errors).some(Boolean);

  const handleWeightChange = (raw: string) => {
    update("weightKg", raw);
    const weight = Number.parseFloat(raw);
    if (Number.isFinite(weight) && weight > 0) update("weightClass", suggestWeightClass(weight));
  };

  const handleSubmit = () => {
    if (hasErrors) {
      setShowErrors(true);
      return;
    }
    onSubmit(values);
  };

  return (
    <View style={styles.container}>
      <AppText variant="label">Basic Info</AppText>
      <Input
        label="Full Name"
        value={values.name}
        onChangeText={(value) => update("name", value)}
        autoCapitalize="words"
        error={showErrors ? errors.name : null}
      />
      <View style={styles.row}>
        <View style={styles.half}>
          <Input label="City" value={values.city} onChangeText={(value) => update("city", value)} placeholder="Bengaluru" />
        </View>
        <View style={styles.half}>
          <Input label="State" value={values.state} onChangeText={(value) => update("state", value)} placeholder="Karnataka" />
        </View>
      </View>
      {showErrors && errors.location ? (
        <AppText variant="caption" color={theme.colors.danger}>
          {errors.location}
        </AppText>
      ) : null}

      <View style={styles.locationRow}>
        <Button
          title={values.latitude ? "Location saved" : "Use my current location"}
          variant="secondary"
          size="sm"
          loading={location.loading}
          onPress={async () => {
            const coords = await location.request();
            if (coords) {
              update("latitude", coords.lat);
              update("longitude", coords.lng);
            }
          }}
        />
        <AppText variant="caption" color={theme.colors.textMuted} style={styles.locationHint}>
          Used only to show you nearby fighters and gyms.
        </AppText>
      </View>

      <AppText variant="label">Physical</AppText>
      <View style={styles.row}>
        <View style={styles.half}>
          <Input label="Age" keyboardType="number-pad" value={values.ageYears} onChangeText={(value) => update("ageYears", value)} placeholder="24" />
        </View>
        <View style={styles.half}>
          <Input
            label="Years Training"
            keyboardType="number-pad"
            value={values.yearsExperience}
            onChangeText={(value) => update("yearsExperience", value)}
            placeholder="3"
          />
        </View>
      </View>
      <View style={styles.row}>
        <View style={styles.half}>
          <Input label="Height (cm)" keyboardType="number-pad" value={values.heightCm} onChangeText={(value) => update("heightCm", value)} placeholder="175" />
        </View>
        <View style={styles.half}>
          <Input label="Weight (kg)" keyboardType="decimal-pad" value={values.weightKg} onChangeText={handleWeightChange} placeholder="70.5" />
        </View>
      </View>

      {suggested ? (
        <View style={styles.suggestion}>
          <AppText variant="caption">
            Suggested weight class:{" "}
            <AppText variant="caption" color={theme.colors.success} style={styles.suggestionValue}>
              {suggested.replace(/_/g, " ")}
            </AppText>{" "}
            — you can correct it below.
          </AppText>
        </View>
      ) : null}

      <AppText variant="label">Weight Class</AppText>
      <View style={styles.chips}>
        {WEIGHT_CLASSES.map((weightClass) => (
          <Chip
            key={weightClass}
            label={`${weightClass.replace(/_/g, " ")} · ${WEIGHT_CLASS_RANGE_LABELS[weightClass]}`}
            selected={values.weightClass === weightClass}
            onPress={() => update("weightClass", weightClass)}
          />
        ))}
      </View>
      {showErrors && errors.weightClass ? (
        <AppText variant="caption" color={theme.colors.danger}>
          {errors.weightClass}
        </AppText>
      ) : null}

      <AppText variant="label">Experience</AppText>
      <View style={styles.row}>
        <View style={styles.half}>
          <Input
            label="Amateur Fights"
            keyboardType="number-pad"
            value={values.totalAmateurFights}
            onChangeText={(value) => update("totalAmateurFights", value)}
            placeholder="0"
          />
        </View>
        <View style={styles.half}>
          <Input
            label="Pro Fights"
            keyboardType="number-pad"
            value={values.totalProFights}
            onChangeText={(value) => update("totalProFights", value)}
            placeholder="0"
          />
        </View>
      </View>

      <AppText variant="label">Disciplines</AppText>
      <View style={styles.chips}>
        {DISCIPLINES.map((discipline) => (
          <Chip
            key={discipline}
            label={discipline.replace(/_/g, " ")}
            selected={values.disciplines.includes(discipline)}
            onPress={() =>
              update(
                "disciplines",
                values.disciplines.includes(discipline)
                  ? values.disciplines.filter((item) => item !== discipline)
                  : [...values.disciplines, discipline],
              )
            }
          />
        ))}
      </View>
      {showErrors && errors.disciplines ? (
        <AppText variant="caption" color={theme.colors.danger}>
          {errors.disciplines}
        </AppText>
      ) : null}

      <AppText variant="label">Skill Level</AppText>
      <View style={styles.chips}>
        {SKILL_LEVELS.map((skill) => (
          <Chip key={skill} label={skill} selected={values.skillLevel === skill} onPress={() => update("skillLevel", skill)} />
        ))}
      </View>
      {showErrors && errors.skill ? (
        <AppText variant="caption" color={theme.colors.danger}>
          {errors.skill}
        </AppText>
      ) : null}

      <AppText variant="label">About You</AppText>
      <TextArea
        label="Bio (optional)"
        placeholder="Tell potential sparring partners about your style, goals and availability."
        value={values.bio}
        onChangeText={(value) => update("bio", value)}
      />

      <Button title={submitLabel} size="lg" loading={loading} onPress={handleSubmit} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 14 },
  row: { flexDirection: "row", gap: 12 },
  half: { flex: 1, minWidth: 0 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  suggestion: {
    backgroundColor: theme.colors.successSoft,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.success + "44",
    padding: 10,
  },
  suggestionValue: { fontWeight: "700", textTransform: "capitalize" },
  locationRow: { gap: 6 },
  locationHint: {},
});
