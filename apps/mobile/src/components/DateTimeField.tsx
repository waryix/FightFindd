import { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";

interface DateTimeFieldProps {
  mode: "date" | "time";
  value: Date | null;
  onChange: (value: Date) => void;
  placeholder?: string;
}

export function DateTimeField({ mode, value, onChange, placeholder }: DateTimeFieldProps) {
  const [show, setShow] = useState(false);

  const display = value
    ? mode === "date"
      ? value.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
      : value.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
    : "";

  return (
    <View>
      <TouchableOpacity style={styles.field} onPress={() => setShow(true)}>
        <Text style={[styles.value, !display && styles.placeholder]}>{display || placeholder || "Select"}</Text>
        <Ionicons name={mode === "date" ? "calendar-outline" : "time-outline"} size={18} color="#666666" />
      </TouchableOpacity>

      {show ? (
        <DateTimePicker
          value={value ?? new Date()}
          mode={mode}
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={(_event: unknown, date?: Date) => {
            setShow(false);
            if (date) onChange(date);
          }}
        />
      ) : null}
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
  value: { color: "#ffffff", fontSize: 16 },
  placeholder: { color: "#444444" },
});
