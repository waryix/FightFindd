import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const {
  initializeApp,
  getApps,
  cert,
} = require("firebase-admin/app");

const { getMessaging } = require("firebase-admin/messaging");

const serviceAccount = require(path.join(__dirname, "../../fightfind-2d9c6-firebase-adminsdk-fbsvc-a284bb0a86.json"));

if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccount),
  });
}

export async function sendPushNotification(
  pushToken: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<boolean> {
  try {
    if (pushToken.startsWith("ExponentPushToken")) {
      const response = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: pushToken,
          title,
          body,
          data: data ?? {},
          sound: "default",
          priority: "high",
        }),
      });
      const result = await response.json();
      console.log("Expo push result:", JSON.stringify(result));
      return true;
    } else {
      await getMessaging().send({
        token: pushToken,
        notification: { title, body },
        data: data ?? {},
        android: { priority: "high" },
      });
      return true;
    }
  } catch (err: any) {
    console.error("Push notification failed:", err.message);
    return false;
  }
}
