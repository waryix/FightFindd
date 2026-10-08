import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Avatar, Badge, Button, Card, ErrorState, InfoGrid, LoadingState, ScreenScroll, SectionLabel, StatGrid, AppText } from "@fightfind/ui";
import { theme } from "@fightfind/config";
import { api } from "../../src/api/client";
import { errorMessage } from "../../src/api/errors";
import { useAuth } from "../../src/auth/auth-context";
import { notify, confirm } from "../../src/ui/dialog";
import { pickImage } from "../../src/services/media";

export default function ProfileScreen() {
  const router = useRouter();
  const { user, entitlements, isGuest, signOut } = useAuth();
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);

  const query = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => api.fighters.me(),
    enabled: Boolean(user) && !isGuest,
  });

  const handleAvatar = async () => {
    try {
      const picked = await pickImage({ aspect: [1, 1] });
      if (picked.canceled || !picked.upload) return;
      setUploading(true);
      await api.fighters.uploadAvatar(picked.upload);
      await queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      notify("Photo updated", "Your new profile photo is live.");
    } catch (error) {
      notify("Upload failed", errorMessage(error));
    } finally {
      setUploading(false);
    }
  };

  const handleLogout = () => {
    confirm(
      "Log out?",
      "You can log back in anytime with the same number.",
      async () => {
        await signOut();
        router.replace("/");
      },
      { confirmLabel: "Log out", destructive: true },
    );
  };

  if (isGuest) {
    return (
      <ScreenScroll>
        <View style={styles.guestHeader}>
          <Avatar name="Guest Fighter" size={90} />
          <AppText variant="heading">Browsing as guest</AppText>
          <AppText variant="caption" center>
            Create a free account to send sparring requests, chat, join gyms and build your fighter profile.
          </AppText>
        </View>
        <Button title="Create Account" size="lg" onPress={() => router.push("/(auth)/signup")} />
        <Button title="Log In" variant="secondary" onPress={() => router.push("/(auth)/login")} />
        <Button title="Log out" variant="ghost" onPress={handleLogout} />
      </ScreenScroll>
    );
  }

  if (query.isPending) return <LoadingState message="Loading profile…" />;
  if (query.isError) {
    return <ErrorState message="Couldn't load your profile" detail={errorMessage(query.error)} onRetry={() => void query.refetch()} />;
  }
  if (!query.data.fighter) {
    return (
      <ScreenScroll contentStyle={styles.centered}>
        <AppText variant="subheading" center>
          Complete your fighter profile
        </AppText>
        <Button title="Set up profile" onPress={() => router.push("/(auth)/profile-setup")} />
      </ScreenScroll>
    );
  }

  const fighter = query.data.fighter;

  return (
    <ScreenScroll>
      <View style={styles.header}>
        <Pressable onPress={handleAvatar} accessibilityRole="button" accessibilityLabel="Change profile photo">
          <View>
            <Avatar name={fighter.name} avatarUrl={fighter.avatarUrl} size={96} />
            <View style={styles.editBadge}>
              <AppText variant="caption" color="#fff">
                {uploading ? "…" : "+"}
              </AppText>
            </View>
          </View>
        </Pressable>
        <View style={styles.nameRow}>
          <AppText variant="heading">{fighter.name}</AppText>
          {fighter.verificationStatus === "verified" ? <Badge label="Verified" tone="success" /> : null}
        </View>
        <AppText variant="caption">
          {fighter.city}, {fighter.state}
        </AppText>
      </View>

      <Card style={styles.premiumCard}>
        {entitlements?.isPremium ? (
          <>
            <View style={styles.premiumRow}>
              <AppText variant="bodyStrong">FightFind Pro</AppText>
              <Badge label="Active" tone="success" />
            </View>
            <AppText variant="caption">
              Premium until{" "}
              {entitlements.premiumUntil
                ? new Date(entitlements.premiumUntil).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                : "renewal"}
              .
            </AppText>
            <Button title="Manage Pro" variant="secondary" size="sm" onPress={() => router.push("/(tabs)/premium")} />
          </>
        ) : (
          <>
            <AppText variant="bodyStrong">Upgrade to FightFind Pro</AppText>
            <AppText variant="caption">
              Advanced filters, unlimited sparring requests, profile boost and a Pro badge.
            </AppText>
            <Button title="See Pro plan" size="sm" onPress={() => router.push("/(tabs)/premium")} />
          </>
        )}
      </Card>

      <StatGrid
        items={[
          { value: fighter.yearsExperience, label: "Years Training" },
          { value: fighter.totalAmateurFights, label: "Amateur Fights" },
          { value: fighter.totalProFights, label: "Pro Fights" },
        ]}
      />

      <InfoGrid
        items={[
          { label: "Height", value: fighter.heightCm ? `${fighter.heightCm} cm` : null },
          { label: "Weight", value: fighter.weightKg ? `${fighter.weightKg} kg` : null },
          { label: "Age", value: fighter.ageYears ? `${fighter.ageYears} yrs` : null },
          { label: "Weight class", value: fighter.weightClass.replace(/_/g, " ") },
        ]}
      />

      <View>
        <SectionLabel>Disciplines</SectionLabel>
        <View style={styles.chips}>
          {fighter.disciplines.map((discipline) => (
            <Card key={discipline} padded={false} style={styles.chip}>
              <AppText variant="caption" style={styles.chipText}>
                {discipline.replace(/_/g, " ")}
              </AppText>
            </Card>
          ))}
        </View>
      </View>

      {fighter.bio ? (
        <View>
          <SectionLabel>Bio</SectionLabel>
          <AppText variant="body" color={theme.colors.textSecondary} style={styles.bio}>
            {fighter.bio}
          </AppText>
        </View>
      ) : null}

      <Button title="Edit Profile" variant="secondary" onPress={() => router.push("/(tabs)/edit-profile")} />
      <Button title="My Memberships" variant="secondary" onPress={() => router.push("/(tabs)/memberships")} />
      <Button title="Notifications" variant="secondary" onPress={() => router.push("/(tabs)/notifications")} />
      <Button title="Log Out" variant="ghost" onPress={handleLogout} />
      <AppText variant="caption" color={theme.colors.textFaint} center>
        {user?.phone ?? user?.email}
      </AppText>
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  centered: { justifyContent: "center" },
  guestHeader: { alignItems: "center", gap: 10, paddingVertical: 24 },
  header: { alignItems: "center", gap: 8 },
  editBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: theme.colors.primary,
    borderWidth: 2,
    borderColor: theme.colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  nameRow: { flexDirection: "row", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "center" },
  premiumCard: { gap: 8, borderColor: theme.colors.primaryBorder },
  premiumRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: theme.radii.md, borderColor: theme.colors.border },
  chipText: { textTransform: "capitalize" },
  bio: { lineHeight: 22 },
});
