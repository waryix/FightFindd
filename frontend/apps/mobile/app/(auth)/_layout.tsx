import { Stack } from "expo-router";

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#0A0A0A" },
        headerTintColor: "#fff",
        headerShadowVisible: false,
        contentStyle: { backgroundColor: "#0A0A0A" },
      }}
    >
      <Stack.Screen name="signup" options={{ title: "Create Account" }} />
      <Stack.Screen name="login" options={{ title: "Log In" }} />
      <Stack.Screen name="otp" options={{ title: "Verify" }} />
      <Stack.Screen name="profile-setup" options={{ title: "Fighter Profile", headerBackVisible: false }} />
    </Stack>
  );
}
