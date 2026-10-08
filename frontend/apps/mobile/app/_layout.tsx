import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { View, ActivityIndicator } from "react-native";
import { theme } from "@fightfind/config";
import { AuthProvider, useAuth } from "../src/auth/auth-context";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

function RootNavigator() {
  const { status, user } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") return;
    const first = segments?.[0] as string | undefined;
    const inAuthGroup = first === "(auth)";
    const onLanding = !first;
    const onPaymentResult = first === "payment-result";

    if (status === "signed_out") {
      if (!onLanding && !inAuthGroup && first !== "gym-preview") {
        router.replace("/");
      }
      return;
    }
    if (onLanding) {
      if (user && !user.onboarding.hasFighterProfile && !user.isGuest) {
        router.replace("/(auth)/profile-setup");
      } else {
        router.replace("/(tabs)/discover");
      }
      return;
    }
    if (
      user &&
      !user.isGuest &&
      !user.onboarding.hasFighterProfile &&
      !inAuthGroup &&
      !onPaymentResult
    ) {
      router.replace("/(auth)/profile-setup");
    }
  }, [status, user, segments, router]);

  if (status === "loading") {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={theme.colors.primary} size="large" />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.background },
        headerTintColor: theme.colors.textPrimary,
        headerTitleStyle: { fontWeight: "700" },
        contentStyle: { backgroundColor: theme.colors.background },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="payment-result" options={{ title: "Payment", headerBackVisible: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="light" />
          <RootNavigator />
        </AuthProvider>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
