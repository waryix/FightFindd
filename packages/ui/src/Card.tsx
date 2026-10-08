import { StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from "react-native";
import { theme } from "@fightfind/config";

interface CardProps extends ViewProps {
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Card({ padded = true, style, ...rest }: CardProps) {
  return <View {...rest} style={[styles.card, padded && styles.padded, style]} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  padded: { padding: 16 },
});
