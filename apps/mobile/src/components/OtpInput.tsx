import { useRef } from "react";
import { View, TextInput, StyleSheet, useWindowDimensions } from "react-native";

interface OtpInputProps {
  value: string;
  onChange: (otp: string) => void;
  length?: number;
  autoFocus?: boolean;
}

export function OtpInput({ value, onChange, length = 6, autoFocus = true }: OtpInputProps) {
  const { width } = useWindowDimensions();
  const inputs = useRef<(TextInput | null)[]>([]);

  const gap = 8;
  const horizontalPadding = 48;
  const maxSize = 58;
  const size = Math.max(
    36,
    Math.min(maxSize, Math.floor((width - horizontalPadding - gap * (length - 1)) / length))
  );

  const digits = Array.from({ length }, (_, i) => value[i] ?? "");

  const setDigit = (idx: number, raw: string) => {
    const clean = raw.replace(/[^0-9]/g, "");
    const arr = value.split("");
    if (clean === "") {
      arr[idx] = "";
    } else {
      const chars = clean.slice(0, length - idx).split("");
      chars.forEach((c, k) => {
        arr[idx + k] = c;
      });
      const next = Math.min(length - 1, idx + chars.length);
      inputs.current[next]?.focus();
    }
    onChange(arr.join("").slice(0, length));
  };

  const handleKeyPress = (e: any, idx: number) => {
    if (e.nativeEvent.key === "Backspace" && !digits[idx] && idx > 0) {
      inputs.current[idx - 1]?.focus();
    }
  };

  return (
    <View style={[styles.row, { gap }]}>
      {digits.map((digit, idx) => (
        <TextInput
          key={idx}
          ref={(ref) => {
            inputs.current[idx] = ref;
          }}
          style={[styles.box, { width: size, height: size }, digit ? styles.boxFilled : null]}
          value={digit}
          onChangeText={(t) => setDigit(idx, t)}
          onKeyPress={(e) => handleKeyPress(e, idx)}
          keyboardType="number-pad"
          maxLength={length}
          textAlign="center"
          autoFocus={autoFocus && idx === 0}
          placeholderTextColor="#444"
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "center", marginBottom: 24 },
  box: {
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2a2a2a",
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
    padding: 0,
    minWidth: 0,
  },
  boxFilled: { borderColor: "#e63946" },
});
