import { useState } from "react";
import { Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Button, Input, ScreenScroll, AppText } from "@fightfind/ui";
import { theme } from "@fightfind/config";
import { useAuth } from "../../src/auth/auth-context";
import { errorMessage } from "../../src/api/errors";

export default function LoginScreen() {
  const router = useRouter();
  const { requestOtp } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const looksLikeEmail = identifier.includes("@");
  const phoneDigits = identifier.replace(/\D/g, "").slice(-10);
  const validPhone = /^[6-9]\d{9}$/.test(phoneDigits);
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier.trim());
  const isValid = looksLikeEmail ? validEmail : validPhone;

  const handleContinue = async () => {
    if (!isValid) {
      setError(looksLikeEmail ? "Enter a valid email address." : "Enter a valid 10-digit mobile number.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const channel = looksLikeEmail ? "email" : "phone";
      const result = await requestOtp({
        channel,
        identifier: looksLikeEmail ? identifier.trim() : phoneDigits,
        purpose: "login",
      });
      router.push({
        pathname: "/(auth)/otp",
        params: {
          challengeId: result.challengeId,
          channel,
          identifier: result.identifier,
          mode: "login",
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
      <AppText variant="title">Welcome{"\n"}back</AppText>
      <AppText variant="caption">Log in with your mobile number or email</AppText>

      {error ? (
        <AppText variant="caption" color={theme.colors.danger}>
          {error}
        </AppText>
      ) : null}

      <Input
        label="Mobile or Email"
        placeholder="+91 98765 43210 or arjun@gmail.com"
        keyboardType={looksLikeEmail ? "email-address" : "default"}
        autoCapitalize="none"
        autoCorrect={false}
        value={identifier}
        onChangeText={setIdentifier}
      />

      {isValid ? (
        <AppText variant="caption" color={theme.colors.textMuted}>
          A 6-digit OTP will be sent to {looksLikeEmail ? identifier.trim() : `+91 ${phoneDigits}`}.
        </AppText>
      ) : null}

      <Button title="Send OTP" size="lg" loading={loading} onPress={handleContinue} />

      <Pressable onPress={() => router.replace("/(auth)/signup")} accessibilityRole="button">
        <AppText variant="caption" center>
          New to FightFind? <AppText variant="caption" color={theme.colors.primary}>Create Account</AppText>
        </AppText>
      </Pressable>
    </ScreenScroll>
  );
}

