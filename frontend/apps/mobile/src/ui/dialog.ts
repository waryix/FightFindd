import { Alert, Platform } from "react-native";

/**
 * Cross-platform dialogs. `Alert` from react-native-web is a no-op, so web
 * falls back to the browser's native alert/confirm to keep feedback visible.
 */
export function notify(title: string, message?: string): void {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined") window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}

export interface ConfirmOptions {
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

export function confirm(
  title: string,
  message: string,
  onConfirm: () => void,
  options: ConfirmOptions = {},
): void {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined" && window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: options.cancelLabel ?? "Cancel", style: "cancel" },
    {
      text: options.confirmLabel ?? "Confirm",
      style: options.destructive ? "destructive" : "default",
      onPress: onConfirm,
    },
  ]);
}
