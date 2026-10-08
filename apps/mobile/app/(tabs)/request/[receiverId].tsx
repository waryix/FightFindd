import { useState } from "react";
import { View, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { Button, Card, Chip, Input, TextArea, ScreenScroll, SectionLabel, AppText } from "@fightfind/ui";
import { theme } from "@fightfind/config";
import type { Discipline } from "@fightfind/types";
import { api } from "../../../src/api/client";
import { errorMessage } from "../../../src/api/errors";
import { track } from "../../../src/analytics";

const COMMON_LOCATIONS = [
  "Iron Fist MMA, Koramangala",
  "Knockout Boxing Club, Indiranagar",
  "Champions Muay Thai, HSR Layout",
  "To be decided in chat",
];

const formatDateInput = (raw: string): string => {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  const parts = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean);
  return parts.join("-");
};

export default function RequestSparringScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{
    receiverId: string;
    receiverName: string;
    receiverSkill: string;
    receiverDisciplines: string;
  }>();

  const disciplines = ((): Discipline[] => {
    try {
      return JSON.parse(params.receiverDisciplines ?? "[]") as Discipline[];
    } catch {
      return [];
    }
  })();

  const [discipline, setDiscipline] = useState<Discipline | null>(disciplines.length === 1 ? disciplines[0]! : null);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [location, setLocation] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const dateValid = /^\d{2}-\d{2}-\d{4}$/.test(date);
  const timeValid = /^\d{2}:\d{2}$/.test(time);
  const isValid = Boolean(discipline) && dateValid && timeValid && location.trim().length > 1;

  const handleSubmit = async () => {
    if (!isValid) {
      setError("Fill in discipline, date (DD-MM-YYYY), time and location.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const [day, month, year] = date.split("-");
      const proposedDate = new Date(`${year}-${month}-${day}T${time}:00+05:30`);
      if (Number.isNaN(proposedDate.getTime()) || proposedDate.getTime() < Date.now()) {
        setError("Pick a valid future date and time.");
        return;
      }
      await api.matches.create({
        receiverId: params.receiverId!,
        discipline: discipline!,
        proposedDate: proposedDate.toISOString(),
        proposedLocation: location.trim(),
        message: message.trim() || null,
      });
      track("sparring_request_created", { receiverId: params.receiverId });
      await queryClient.invalidateQueries({ queryKey: ["matches"] });
      router.replace("/(tabs)/matches");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenScroll>
      <Card style={styles.target}>
        <AppText variant="subheading">{params.receiverName}</AppText>
        <AppText variant="caption" style={styles.targetMeta}>
          {params.receiverSkill} · {(disciplines.length ? disciplines : ["mixed"]).join(", ").replace(/_/g, " ")}
        </AppText>
      </Card>

      {error ? (
        <AppText variant="caption" color={theme.colors.danger}>
          {error}
        </AppText>
      ) : null}

      <SectionLabel>Discipline *</SectionLabel>
      <View style={styles.chips}>
        {(disciplines.length ? disciplines : (["boxing", "mma"] as Discipline[])).map((option) => (
          <Chip
            key={option}
            label={option.replace(/_/g, " ")}
            selected={discipline === option}
            onPress={() => setDiscipline(option)}
          />
        ))}
      </View>

      <View style={styles.row}>
        <View style={styles.half}>
          <Input
            label="Date * (DD-MM-YYYY)"
            placeholder="15-10-2026"
            value={date}
            onChangeText={(value) => setDate(formatDateInput(value))}
            keyboardType="number-pad"
            inputMode="numeric"
            maxLength={10}
            error={date.length > 0 && !dateValid ? "Use DD-MM-YYYY" : null}
          />
        </View>
        <View style={styles.half}>
          <Input
            label="Time * (24h)"
            placeholder="07:00"
            value={time}
            onChangeText={setTime}
            keyboardType="numbers-and-punctuation"
            error={time.length > 0 && !timeValid ? "Use HH:MM" : null}
          />
        </View>
      </View>

      <SectionLabel>Location *</SectionLabel>
      <View style={styles.chips}>
        {COMMON_LOCATIONS.map((option) => (
          <Chip key={option} label={option} selected={location === option} onPress={() => setLocation(option)} />
        ))}
      </View>
      <Input label="Or type a location" placeholder="Gym or area" value={location} onChangeText={setLocation} />

      <TextArea
        label="Message (optional)"
        placeholder="Tell them your goals, rounds and rules — e.g. '6 rounds technical boxing, 70kg'."
        value={message}
        onChangeText={setMessage}
      />

      <Button title="Send Sparring Request" size="lg" loading={loading} disabled={!isValid} onPress={handleSubmit} />
      <Button title="Cancel" variant="ghost" onPress={() => router.back()} />
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  target: { gap: 4, borderColor: theme.colors.primaryBorder },
  targetMeta: { textTransform: "capitalize" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  row: { flexDirection: "row", gap: 12 },
  half: { flex: 1, minWidth: 0 },
});
