import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Button, Screen, AppText } from "@fightfind/ui";
import { theme } from "@fightfind/config";
import { useAuth } from "../src/auth/auth-context";
import { errorMessage } from "../src/api/errors";
import { track } from "../src/analytics";

export default function LandingScreen() {
  const router = useRouter();
  const { continueAsGuest } = useAuth();
  const [guestLoading, setGuestLoading] = useState(false);
  const [error, setError] = useState("");

  const handleGuest = async () => {
    setGuestLoading(true);
    setError("");
    try {
      await continueAsGuest();
      track("guest_browse_started");
      router.replace("/(tabs)/discover");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setGuestLoading(false);
    }
  };

  return (
    <Screen style={styles.container}>
      <View style={styles.hero}>
        <View style={styles.logoBox}>
          <AppText variant="hero" style={styles.logoText}>
            FF
          </AppText>
        </View>
        <AppText variant="hero">FightFind</AppText>
        <AppText variant="body" center color={theme.colors.textSecondary} style={styles.tagline}>
          Find sparring partners.{"\n"}Discover gyms. Train harder.
        </AppText>
      </View>

      <View style={styles.bottom}>
        {error ? (
          <AppText variant="caption" color={theme.colors.danger} center>
            {error}
          </AppText>
        ) : null}
        <Button title="Create Account" size="lg" onPress={() => router.push("/(auth)/signup")} />
        <Button title="Log In" variant="secondary" size="lg" onPress={() => router.push("/(auth)/login")} />
        <Button
          title="Browse as Guest"
          variant="ghost"
          loading={guestLoading}
          onPress={handleGuest}
        />
        <AppText variant="caption" color={theme.colors.textFaint} center style={styles.hint}>
          For boxers, MMA fighters, kickboxers and grapplers across India
        </AppText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 24, justifyContent: "space-between", paddingTop: 96, paddingBottom: 48 },
  hero: { alignItems: "center", gap: 12 },
  logoBox: {
    width: 92,
    height: 92,
    borderRadius: 26,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  logoText: { fontSize: 38, letterSpacing: -1 },
  tagline: { lineHeight: 24 },
  bottom: { gap: 12 },
  hint: { marginTop: 4 },
});
