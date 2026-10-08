import { Modal, Platform, StyleSheet, TouchableOpacity, View } from "react-native";
import { WebView } from "react-native-webview";
import { AppText } from "@fightfind/ui";
import { theme } from "@fightfind/config";

interface Props {
  visible: boolean;
  url: string | null;
  onClose: () => void;
  onResult: (params: Record<string, string>) => void;
}

const CALLBACK_PREFIX = "fightfind://payment-result";

function parseCallback(url: string): Record<string, string> | null {
  if (!url.startsWith(CALLBACK_PREFIX)) return null;
  const query = url.split("?")[1] ?? "";
  const params: Record<string, string> = {};
  for (const pair of query.split("&")) {
    const [key, value] = pair.split("=");
    if (key) params[decodeURIComponent(key)] = decodeURIComponent(value ?? "");
  }
  return params;
}

/** Hosted Razorpay Checkout inside a WebView; results return via deep link. */
export function CheckoutModal({ visible, url, onClose, onResult }: Props) {
  // react-native-webview has no web implementation; web uses a popup instead.
  if (Platform.OS === "web") return null;
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <AppText variant="subheading">Secure payment</AppText>
          <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Close payment">
            <AppText variant="caption" color={theme.colors.primary} style={styles.close}>
              Close
            </AppText>
          </TouchableOpacity>
        </View>
        {url ? (
          <WebView
            source={{ uri: url }}
            style={styles.webview}
            originWhitelist={["*"]}
            onShouldStartLoadWithRequest={(request) => {
              const params = parseCallback(request.url);
              if (params) {
                onResult(params);
                return false;
              }
              return true;
            }}
          />
        ) : (
          <View style={styles.webview} />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    paddingTop: 56,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  close: { fontWeight: "700" },
  webview: { flex: 1, backgroundColor: theme.colors.background },
});
