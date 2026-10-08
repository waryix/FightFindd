import { StyleSheet, View } from "react-native";
import { Button, Card, AppText } from "@fightfind/ui";
import { theme } from "@fightfind/config";

interface Props {
  title: string;
  message: string;
  loading?: boolean;
  denied?: boolean;
  onAllow: () => void;
  onDismiss: () => void;
}

/** Inline, explainable location permission prompt — never shown on app start. */
export function LocationPrompt({ title, message, loading, denied, onAllow, onDismiss }: Props) {
  return (
    <Card style={styles.card}>
      <AppText variant="subheading">{title}</AppText>
      <AppText variant="caption" style={styles.message}>
        {message}
      </AppText>
      {denied ? (
        <View style={styles.row}>
          <Button title="Choose a city instead" variant="secondary" size="sm" onPress={onDismiss} style={styles.button} />
          <Button title="Enable Location" size="sm" loading={loading} onPress={onAllow} style={styles.button} />
        </View>
      ) : (
        <View style={styles.row}>
          <Button title="Not Now" variant="secondary" size="sm" onPress={onDismiss} style={styles.button} />
          <Button title="Allow Location" size="sm" loading={loading} onPress={onAllow} style={styles.button} />
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { borderColor: theme.colors.primaryBorder, backgroundColor: theme.colors.surface, gap: 6 },
  message: { lineHeight: 18 },
  row: { flexDirection: "row", gap: 10, marginTop: 10 },
  button: { flex: 1 },
});
