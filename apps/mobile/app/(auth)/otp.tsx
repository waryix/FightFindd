import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Button, ScreenScroll, AppText } from "@fightfind/ui";
import { theme } from "@fightfind/config";
import { useAuth } from "../../src/auth/auth-context";
import { errorMessage } from "../../src/api/errors";
import { track } from "../../src/analytics";

export default function OtpScreen() {
  const router = useRouter();
  const { verifyOtp, requestOtp } = useAuth();
  const params = useLocalSearchParams<{
    challengeId: string;
    channel: "phone" | "email";
    identifier: string;
    name?: string;
    mode?: "login" | "signup";
    devOtp?: string;
  }>();

  const [challengeId, setChallengeId] = useState(params.challengeId);
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [devOtp, setDevOtp] = useState(params.devOtp ?? "");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const inputs = useRef<Array<TextInput | null>>([]);

  useEffect(() => {
    inputs.current[0]?.focus();
  }, []);

  const code = digits.join("");

  const handleChange = (value: string, index: number) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[index] = digit;
    setDigits(next);
    if (digit && index < 5) inputs.current[index + 1]?.focus();
    if (!digit && index > 0) inputs.current[index - 1]?.focus();
  };

  const handleVerify = async () => {
    if (code.length !== 6) {
      setError("Enter the complete 6-digit code.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const user = await verifyOtp({
        challengeId,
        code,
        name: params.name,
      });
      track("otp_verified", { mode: params.mode ?? "login" });
      if (!user.isGuest && !user.onboarding.hasFighterProfile) {
        router.replace("/(auth)/profile-setup");
      } else {
        router.replace("/(tabs)/discover");
      }
    } catch (err) {
      setError(errorMessage(err));
      setDigits(["", "", "", "", "", ""]);
      inputs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setError("");
    try {
      const result = await requestOtp({
        channel: params.channel ?? "phone",
        identifier: params.identifier ?? "",
        purpose: params.mode === "signup" ? "signup" : "login",
        name: params.name,
      });
      setChallengeId(result.challengeId);
      setDevOtp(result.devOtp ?? "");
      setDigits(["", "", "", "", "", ""]);
      inputs.current[0]?.focus();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setResending(false);
    }
  };

  return (
    <ScreenScroll>
      <AppText variant="title">Enter the code</AppText>
      <AppText variant="caption">
        Sent to {params.channel === "email" ? params.identifier : params.identifier}
      </AppText>

      {devOtp ? (
        <View style={styles.devBox}>
          <AppText variant="caption" color={theme.colors.warning}>
            Development OTP: {devOtp}
          </AppText>
        </View>
      ) : null}

      <View style={styles.otpRow}>
        {digits.map((digit, index) => (
          <TextInput
            key={index}
            ref={(ref) => {
              inputs.current[index] = ref;
            }}
            style={[styles.otpInput, digit ? styles.otpFilled : null]}
            value={digit}
            onChangeText={(value) => handleChange(value, index)}
            keyboardType="number-pad"
            maxLength={1}
            accessibilityLabel={`OTP digit ${index + 1}`}
            autoFocus={index === 0}
          />
        ))}
      </View>

      {error ? (
        <AppText variant="caption" color={theme.colors.danger}>
          {error}
        </AppText>
      ) : null}

      <Button title={params.mode === "signup" ? "Verify & Continue" : "Log In"} size="lg" loading={loading} disabled={code.length !== 6} onPress={handleVerify} />

      <Pressable onPress={handleResend} disabled={resending} accessibilityRole="button">
        <AppText variant="caption" center color={theme.colors.primary}>
          {resending ? "Resending…" : "Resend OTP"}
        </AppText>
      </Pressable>
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  devBox: {
    backgroundColor: theme.colors.warningSoft,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.warning + "55",
    padding: 10,
  },
  otpRow: { flexDirection: "row", gap: 8 },
  otpInput: {
    flex: 1,
    backgroundColor: theme.colors.surfaceRaised,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: 16,
    fontSize: 22,
    fontWeight: "700",
    color: theme.colors.textPrimary,
    textAlign: "center",
  },
  otpFilled: { borderColor: theme.colors.primary },
});
