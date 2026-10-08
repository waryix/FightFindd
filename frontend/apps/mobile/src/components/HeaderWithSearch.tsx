import { useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, TextInput, View, type DimensionValue, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@fightfind/config";
import { AppText } from "@fightfind/ui";

interface Props {
  title: string;
  subtitle: string;
  searchValue: string;
  onChangeSearch: (value: string) => void;
  searchPlaceholder?: string;
  filterCount?: number;
  onOpenFilters: () => void;
}

const BUTTON = 38;

/**
 * Screen header: title on the left; compact search + filter icon buttons on the
 * right. Tapping search expands it into a small inline pill (~25% width on web)
 * that stays next to the filter icon — the title never disappears.
 */
export function HeaderWithSearch({
  title,
  subtitle,
  searchValue,
  onChangeSearch,
  searchPlaceholder = "Search…",
  filterCount = 0,
  onOpenFilters,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const inputRef = useRef<TextInput>(null);
  // ~25% on web (as requested); a bit wider on native where screens are narrower.
  const searchWidth: DimensionValue = Platform.OS === "web" ? "25%" : "55%";

  const expand = () => {
    setExpanded(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  return (
    <View style={styles.header}>
      <View style={styles.headerText}>
        <AppText variant="title" numberOfLines={1}>
          {title}
        </AppText>
        <AppText variant="caption" numberOfLines={1}>
          {subtitle}
        </AppText>
      </View>

      {expanded ? (
        <View style={[styles.searchPill, { width: searchWidth }]}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={searchValue}
            onChangeText={onChangeSearch}
            placeholder={searchPlaceholder}
            placeholderTextColor={theme.colors.textFaint}
            autoFocus
            returnKeyType="search"
            selectionColor={theme.colors.primary}
            accessibilityLabel="Search"
          />
          <Pressable
            onPress={() => setExpanded(false)}
            accessibilityRole="button"
            accessibilityLabel="Close search"
            hitSlop={8}
          >
            <Ionicons name="close" size={15} color={theme.colors.textSecondary} />
          </Pressable>
        </View>
      ) : (
        <Pressable style={styles.iconButton} onPress={expand} accessibilityRole="button" accessibilityLabel="Search">
          <Ionicons name="search" size={20} color={theme.colors.textPrimary} />
          {searchValue ? <View style={styles.dot} /> : null}
        </Pressable>
      )}

      <Pressable
        style={[styles.iconButton, filterCount > 0 && styles.iconButtonActive]}
        onPress={onOpenFilters}
        accessibilityRole="button"
        accessibilityLabel={`Filters, ${filterCount} active`}
      >
        <Ionicons
          name="options-outline"
          size={20}
          color={filterCount > 0 ? theme.colors.primary : theme.colors.textPrimary}
        />
        {filterCount > 0 ? (
          <View style={styles.badge}>
            <AppText variant="caption" color="#fff" style={styles.badgeText}>
              {filterCount}
            </AppText>
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}

// Web only: kill the browser's default focus ring so the border stays red.
const webOnly: ViewStyle =
  Platform.OS === "web" ? ({ outlineStyle: "none", outlineWidth: 0 } as unknown as ViewStyle) : {};

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 8,
    minHeight: BUTTON + 22,
  },
  headerText: { flex: 1, minWidth: 0, gap: 2 },
  iconButton: {
    width: BUTTON,
    height: BUTTON,
    borderRadius: theme.radii.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceRaised,
    alignItems: "center",
    justifyContent: "center",
    ...webOnly,
  },
  iconButtonActive: { backgroundColor: theme.colors.primarySoft, borderColor: theme.colors.primary },
  dot: {
    position: "absolute",
    top: 7,
    right: 7,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: theme.colors.primary,
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { fontSize: 10, lineHeight: 14, fontWeight: "800" },
  searchPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    height: BUTTON,
    borderRadius: theme.radii.pill,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.surfaceRaised,
    paddingHorizontal: 9,
    overflow: "hidden",
    ...webOnly,
  },
  input: {
    flex: 1,
    minWidth: 0,
    width: 0,
    height: "100%",
    paddingHorizontal: 0,
    fontSize: 13,
    color: theme.colors.textPrimary,
    ...webOnly,
  },
});
