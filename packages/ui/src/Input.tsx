import { StyleSheet, TextInput, View, type TextInputProps } from "react-native";
import { theme } from "@fightfind/config";
import { AppText } from "./primitives.js";

interface InputProps extends TextInputProps {
  label?: string;
  error?: string | null;
  hint?: string | null;
}

export function Input({ label, error, hint, style, ...rest }: InputProps) {
  return (
    <View style={styles.wrapper}>
      {label ? <AppText variant="label">{label}</AppText> : null}
      <TextInput
        placeholderTextColor={theme.colors.textFaint}
        {...rest}
        style={[styles.input, error ? styles.inputError : null, style]}
        accessibilityLabel={rest.accessibilityLabel ?? label}
      />
      {error ? (
        <AppText variant="caption" color={theme.colors.danger}>
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="caption" color={theme.colors.textMuted}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

export function TextArea({ label, error, style, ...rest }: InputProps) {
  return (
    <Input
      label={label}
      error={error}
      multiline
      textAlignVertical="top"
      {...rest}
      style={[styles.textArea, style]}
    />
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 8 },
  input: {
    backgroundColor: theme.colors.surfaceRaised,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: theme.typography.sizes.md,
    color: theme.colors.textPrimary,
  },
  inputError: { borderColor: theme.colors.danger },
  textArea: { minHeight: 100 },
});
