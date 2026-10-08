import { StyleSheet, View } from "react-native";
import { theme } from "@fightfind/config";
import { AppText } from "./primitives.js";
import { formatPaise } from "@fightfind/utils";

export function PriceRow({
  label,
  amountPaise,
  emphasis = false,
  caption,
}: {
  label: string;
  amountPaise: number;
  emphasis?: boolean;
  caption?: string;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.labelBlock}>
        <AppText variant={emphasis ? "bodyStrong" : "body"} color={emphasis ? theme.colors.textPrimary : theme.colors.textSecondary}>
          {label}
        </AppText>
        {caption ? (
          <AppText variant="caption" color={theme.colors.textMuted}>
            {caption}
          </AppText>
        ) : null}
      </View>
      <AppText variant={emphasis ? "subheading" : "bodyStrong"} color={emphasis ? theme.colors.textPrimary : theme.colors.textSecondary}>
        {formatPaise(amountPaise)}
      </AppText>
    </View>
  );
}

export function Divider() {
  return <View style={styles.divider} accessibilityElementsHidden />;
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  labelBlock: { flex: 1, gap: 2 },
  divider: { height: 1, backgroundColor: theme.colors.borderSubtle },
});
