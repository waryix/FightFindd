import { useRef } from "react";
import { Platform } from "react-native";

/**
 * react-native-web's RefreshControl is a no-op, so on web we detect a downward
 * drag while the list is scrolled to the top and trigger a refresh on release.
 * Native platforms keep using the built-in RefreshControl.
 */
export function useWebPullToRefresh(onRefresh: () => void, threshold = 110) {
  const startY = useRef(0);
  const pulling = useRef(false);
  const scrollY = useRef(0);

  const trackScroll = (y: number) => {
    scrollY.current = y;
  };

  const handlers: Record<string, any> =
    Platform.OS === "web"
      ? {
          onTouchStart: (e: any) => {
            const y =
              e?.nativeEvent?.pageY ?? e?.nativeEvent?.touches?.[0]?.pageY ?? 0;
            startY.current = y;
            pulling.current = false;
          },
          onTouchMove: (e: any) => {
            const y =
              e?.nativeEvent?.pageY ?? e?.nativeEvent?.touches?.[0]?.pageY ?? 0;
            if (scrollY.current <= 0 && y - startY.current > threshold) {
              pulling.current = true;
            }
          },
          onTouchEnd: () => {
            if (pulling.current) {
              pulling.current = false;
              onRefresh();
            }
          },
        }
      : {};

  return { trackScroll, handlers };
}
