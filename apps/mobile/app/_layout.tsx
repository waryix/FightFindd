import { Stack, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { getSession } from "../src/store/session";
import { registerForPushNotifications, setupNotificationHandlers } from "../src/services/notifications";
import { API_URL } from "../src/services/config";

export default function RootLayout() {
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    setupNotificationHandlers();
    checkSession();
  }, []);

  useEffect(() => {
    if (!checking && hasSession) {
      router.replace("/(tabs)/discover");
      registerAndSavePushToken();
    }
  }, [checking, hasSession]);

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

  const registerAndSavePushToken = async () => {
    try {
      const fighterId = await getSession();
      if (!fighterId) return;

      const token = await registerForPushNotifications();
      if (!token) return;

      await fetch(`${API_URL}/api/fighters/${fighterId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ push_token: token }),
      });

      console.log("Push token registered:", token);
    } catch (err: any) {
      console.error("Failed to register push token:", err.message);
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
