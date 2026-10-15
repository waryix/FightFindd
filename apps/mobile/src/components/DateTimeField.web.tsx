import { createElement } from "react";
import { View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface DateTimeFieldProps {
  mode: "date" | "time";
  value: Date | null;
  onChange: (value: Date) => void;
  placeholder?: string;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function DateTimeField({ mode, value, onChange }: DateTimeFieldProps) {
  const valueStr = value
    ? mode === "date"
      ? `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`
      : `${pad(value.getHours())}:${pad(value.getMinutes())}`
    : "";

  const input = createElement("input" as any, {
    type: mode === "date" ? "date" : "time",
    value: valueStr,
    onChange: (e: any) => {
      const v: string = e.target.value;
      if (!v) return;
      if (mode === "date") {
        const [y = 1970, m = 1, d = 1] = v.split("-").map(Number);
        onChange(new Date(y, m - 1, d));
      } else {
        const [h = 0, min = 0] = v.split(":").map(Number);
        const base = value ? new Date(value) : new Date();
        base.setHours(h, min, 0, 0);
        onChange(base);
      }
    },
    style: {
      flex: 1,
      minWidth: 0,
      background: "transparent",
      border: "none",
      outline: "none",
      color: "#ffffff",
      fontSize: 16,
      fontFamily: "inherit",
      colorScheme: "dark",
    },
  } as any);

  return (
    <View style={styles.field}>
      {input}
      <Ionicons name={mode === "date" ? "calendar-outline" : "time-outline"} size={18} color="#666666" />
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "#2a2a2a",
  },
});
