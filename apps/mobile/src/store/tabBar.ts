import { useCallback, useRef } from "react";
import {
  Animated,
  Platform,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { useFocusEffect } from "expo-router";

export const TAB_BAR_HEIGHT = 52;

export const tabBarTranslateY = new Animated.Value(0);

let hidden = false;

export function setTabBarHidden(next: boolean) {
  if (next === hidden) return;
  hidden = next;
  Animated.timing(tabBarTranslateY, {
    toValue: next ? -TAB_BAR_HEIGHT : 0,
    duration: 180,
    useNativeDriver: Platform.OS !== "web",
  }).start();
}

export function resetTabBar() {
  hidden = false;
  tabBarTranslateY.setValue(0);
}

/**
 * Returns an onScroll handler that hides the tab bar when the user scrolls
 * down through the content and reveals it when scrolling back up (or at top).
 */
/** Reveals the tab bar whenever the screen regains focus. */
export function useResetTabBarOnFocus() {
  useFocusEffect(
    useCallback(() => {
      resetTabBar();
    }, [])
  );
}

export function useHideTabBarOnScroll(threshold = 8) {
  const lastY = useRef(0);
  return (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const diff = y - lastY.current;
    if (y <= 4) {
      setTabBarHidden(false);
    } else if (diff > threshold) {
      setTabBarHidden(true);
    } else if (diff < -threshold) {
      setTabBarHidden(false);
    }
    lastY.current = y;
  };
}
