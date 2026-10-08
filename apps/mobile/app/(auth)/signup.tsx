import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Button, Input, ScreenScroll, AppText } from "@fightfind/ui";
import { theme } from "@fightfind/config";
import { useAuth } from "../../src/auth/auth-context";
import { errorMessage } from "../../src/api/errors";

export default function SignupScreen() {
  const router = useRouter();
  const { requestOtp } = useAuth();
  const [channel, setChannel] = useState<"phone" | "email">("phone");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const validPhone = /^[6-9]\d{9}$/.test(phone);
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const identifier = channel === "phone" ? phone : email.trim();

  const handleContinue = async () => {
    if (name.trim().length < 2) {
      setError("Enter your full name.");
      return;
    }
    if (channel === "phone" && !validPhone) {
      setError("Enter a valid 10-digit mobile number (starting 6-9).");
      return;
    }
    if (channel === "email" && !validEmail) {
      setError("Enter a valid email address.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await requestOtp({
        channel,
        identifier,
        purpose: "signup",
        name: name.trim(),
      });
      router.push({
        pathname: "/(auth)/otp",
        params: {
          challengeId: result.challengeId,
          channel,
          identifier: result.identifier,
          name: name.trim(),
          mode: "signup",
          ...(result.devOtp ? { devOtp: result.devOtp } : {}),
        },
      });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenScroll>
      <AppText variant="title">Create your{"\n"}account</AppText>
      <AppText variant="caption">Join FightFind and start training</AppText>

      {error ? (
        <AppText variant="caption" color={theme.colors.danger}>
          {error}
        </AppText>
      ) : null}

      <Input label="Full Name" placeholder="e.g. Arjun Singh" value={name} onChangeText={setName} autoCapitalize="words" />

      <View style={styles.channelRow}>
        {(["phone", "email"] as const).map((option) => (
          <Pressable
            key={option}
            onPress={() => setChannel(option)}
            style={[styles.channel, channel === option && styles.channelActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: channel === option }}
          >
            <AppText variant="caption" color={channel === option ? "#fff" : theme.colors.textSecondary} style={styles.channelText}>
              {option === "phone" ? "Mobile OTP" : "Email OTP"}
            </AppText>
          </Pressable>
        ))}
      </View>

      {channel === "phone" ? (
        <View style={styles.phoneRow}>
          <View style={styles.countryCode}>
            <AppText variant="bodyStrong">+91</AppText>
          </View>
          <Input
            label=""
            placeholder="9876543210"
            keyboardType="phone-pad"
            inputMode="numeric"
            maxLength={10}
            value={phone}
            onChangeText={(value) => setPhone(value.replace(/\D/g, "").slice(0, 10))}
            style={styles.phoneInput}
          />
        </View>
      ) : (
        <Input
          label="Email Address"
          placeholder="e.g. arjun@gmail.com"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />
      )}

      <AppText variant="caption" color={theme.colors.textMuted}>
        {channel === "phone"
          ? "We'll text you a 6-digit verification code."
          : "We'll email you a 6-digit verification code."}
      </AppText>

      <Button title="Send OTP" size="lg" loading={loading} onPress={handleContinue} />

      <Pressable onPress={() => router.replace("/(auth)/login")} accessibilityRole="button">
        <AppText variant="caption" center>
          Already have an account? <AppText variant="caption" color={theme.colors.primary}>Log In</AppText>
        </AppText>
      </Pressable>
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  channelRow: { flexDirection: "row", gap: 10 },
  channel: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceRaised,
    borderRadius: theme.radii.md,
    paddingVertical: 10,
    alignItems: "center",
  },
  channelActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  channelText: { fontWeight: "700" },
  phoneRow: { flexDirection: "row", gap: 10, alignItems: "flex-end" },
  countryCode: {
    backgroundColor: theme.colors.surfaceRaised,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  phoneInput: { flex: 1, minWidth: 0 },
});
