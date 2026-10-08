import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { api } from "./api/client";
import { easProjectId } from "./config";

let configured = false;

function configureHandler() {
  if (configured) return;
  configured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

/** Registers the device for push. Best-effort: never blocks a transaction. */
export async function registerForPushNotifications(): Promise<void> {
  try {
    if (!Device.isDevice) return;
    configureHandler();
    const existing = await Notifications.getPermissionsAsync();
    let granted = existing.granted;
    if (!granted) {
      const requested = await Notifications.requestPermissionsAsync();
      granted = requested.granted;
    }
    if (!granted) return;

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "FightFind",
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const token = await Notifications.getExpoPushTokenAsync(
      easProjectId ? { projectId: easProjectId } : undefined,
    );
    if (token.data) {
      await api.notifications.registerDevice({
        token: token.data,
        platform: Platform.OS === "ios" ? "ios" : Platform.OS === "android" ? "android" : "web",
      });
    }
  } catch (error) {
    console.warn("[push] registration skipped:", error);
  }
}
