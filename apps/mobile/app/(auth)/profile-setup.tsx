import { useState } from "react";
import { useRouter } from "expo-router";
import { ScreenScroll } from "@fightfind/ui";
import { useAuth } from "../../src/auth/auth-context";
import { api } from "../../src/api/client";
import { errorMessage } from "../../src/api/errors";
import { ProfileForm, serializeProfile } from "../../src/components/ProfileForm";
import { track } from "../../src/analytics";
import { AppText } from "@fightfind/ui";
import { theme } from "@fightfind/config";

export default function ProfileSetupScreen() {
  const router = useRouter();
  const { user, refresh } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const initial = {
    name: user?.name ?? "",
    city: "",
    state: "",
    ageYears: "",
    heightCm: "",
    weightKg: "",
    yearsExperience: "",
    totalAmateurFights: "",
    totalProFights: "",
    bio: "",
    disciplines: [],
    skillLevel: null,
    weightClass: null,
    latitude: null,
    longitude: null,
  } as const;

  const handleSubmit = async (values: Parameters<typeof serializeProfile>[0]) => {
    setLoading(true);
    setError("");
    try {
      await api.fighters.createProfile(serializeProfile(values));
      track("fighter_profile_completed", { city: values.city, skillLevel: values.skillLevel });
      await refresh();
      router.replace("/(tabs)/discover");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenScroll>
      <AppText variant="title">Complete your{"\n"}fighter profile</AppText>
      <AppText variant="caption">
        {user?.phone ?? user?.email ?? ""} · this is how sparring partners will find you
      </AppText>
      {error ? (
        <AppText variant="caption" color={theme.colors.danger}>
          {error}
        </AppText>
      ) : null}
      <ProfileForm initial={{ ...initial, disciplines: [], skillLevel: null, weightClass: null }} submitLabel="Start Finding Partners" loading={loading} onSubmit={handleSubmit} />
    </ScreenScroll>
  );
}
