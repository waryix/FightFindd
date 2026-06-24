import { Stack, router, usePathname } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { getSession } from "../src/store/session";

export default function RootLayout() {
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const pathname = usePathname();

  useEffect(() => { checkSession(); }, []);

  useEffect(() => {
    if (checking) return;
    if (hasSession && (pathname === "/" || pathname === "")) {
      router.replace("/(tabs)/discover");
    } else if (!hasSession && (pathname === "/" || pathname === "")) {
      router.replace("/(auth)/login");
    }
  }, [checking, hasSession, pathname]);

  const checkSession = async () => {
    try {
      const fighterId = await getSession();
      setHasSession(!!fighterId);
    } catch (err) {
      console.error(err);
    } finally {
      setChecking(false);
    }
  };

  if (checking) {
    return (
      <View style={{ flex: 1, backgroundColor: "#0a0a0a", alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color="#e63946" size="large" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: "#0a0a0a" },
          headerTintColor: "#ffffff",
          headerTitleStyle: { fontWeight: "bold" },
          contentStyle: { backgroundColor: "#0a0a0a" },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}
