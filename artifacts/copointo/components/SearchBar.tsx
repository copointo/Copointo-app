import { Feather } from "@expo/vector-icons";
import React from "react";
import {
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useColors } from "@/hooks/useColors";

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onClear?: () => void;
}

export function SearchBar({ value, onChangeText, placeholder = "Search cafes...", onClear }: SearchBarProps) {
  const colors = useColors();

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.iconWrap, { backgroundColor: colors.secondary }]}>
        <Feather name="search" size={17} color={colors.primary} />
      </View>
      <TextInput
        style={[styles.input, { color: colors.foreground }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
      />
      {value.length > 0 && (
        <TouchableOpacity
          onPress={() => {
            onChangeText("");
            onClear?.();
          }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={[styles.clearBtn, { backgroundColor: colors.secondary }]}
        >
          <Feather name="x" size={14} color={colors.mutedForeground} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1.5,
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 10,
    shadowColor: "#E8B86D",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    padding: 0,
  },
  clearBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    marginEnd: 4,
  },
});
