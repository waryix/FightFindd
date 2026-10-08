import { useState } from "react";
import { useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, ErrorState, LoadingState, ScreenScroll, AppText } from "@fightfind/ui";
import { useAuth } from "../../src/auth/auth-context";
import { api } from "../../src/api/client";
import { errorMessage } from "../../src/api/errors";
import { ProfileForm, profileToFormValues, serializeProfile } from "../../src/components/ProfileForm";
import { track } from "../../src/analytics";
import { theme } from "@fightfind/config";

export default function EditProfileScreen() {
  const router = useRouter();
  const { user, refresh } = useAuth();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const query = useQuery({ queryKey: ["my-profile"], queryFn: () => api.fighters.me() });

  if (query.isPending) return <LoadingState message="Loading profile…" />;
  if (query.isError) {
    return <ErrorState message="Couldn't load your profile" detail={errorMessage(query.error)} onRetry={() => void query.refetch()} />;
  }
  if (!query.data.fighter) {
    return (
      <ScreenScroll contentStyle={{ justifyContent: "center" }}>
        <AppText variant="subheading" center>
          Create your profile first
        </AppText>
        <Button title="Set up profile" onPress={() => router.replace("/(auth)/profile-setup")} />
      </ScreenScroll>
    );
  }

  const handleSubmit = async (values: ReturnType<typeof profileToFormValues>) => {
    setLoading(true);
    setError("");
    try {
      await api.fighters.updateProfile(serializeProfile(values));
      track("fighter_profile_updated");
      await queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      await refresh();
      router.back();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenScroll>
      <AppText variant="title">Edit profile</AppText>
      {error ? (
        <AppText variant="caption" color={theme.colors.danger}>
          {error}
        </AppText>
      ) : null}
      <ProfileForm
        initial={profileToFormValues(query.data.fighter, user?.name ?? "")}
        submitLabel="Save Changes"
        loading={loading}
        onSubmit={handleSubmit}
      />
    </ScreenScroll>
  );
}
