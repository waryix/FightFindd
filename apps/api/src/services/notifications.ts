import * as path from "path";
import * as fs from "fs";

let adminApp: any = null;

function getAdminApp() {
  if (adminApp) return adminApp;

  const { createRequire } = require("module");
  const localRequire = createRequire(__filename);
  const { initializeApp, getApps, cert } = localRequire("firebase-admin/app");

  if (getApps().length) {
    adminApp = getApps()[0];
    return adminApp;
  }

  let credential;

  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    // Production — read from environment variable
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    credential = cert(serviceAccount);
  } else {
    // Development — read from file
    const serviceAccountPath = path.join(__dirname, "../../fightfind-2d9c6-firebase-adminsdk-fbsvc-a284bb0a86.json");
    if (fs.existsSync(serviceAccountPath)) {
      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
      credential = cert(serviceAccount);
    } else {
      console.warn("Firebase service account not found — push notifications disabled");
      return null;
    }
  }

  adminApp = initializeApp({ credential });
  return adminApp;
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
      const app = getAdminApp();
      if (!app) return false;

      const { createRequire } = require("module");
      const localRequire = createRequire(__filename);
      const { getMessaging } = localRequire("firebase-admin/messaging");

      await getMessaging(app).send({
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
