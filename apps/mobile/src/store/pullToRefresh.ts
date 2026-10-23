import { useCallback, useRef } from "react";
import { Platform } from "react-native";

/**
 * react-native-web's RefreshControl is a no-op. This attaches native DOM touch
 * listeners to the scroll node so a downward drag at the top triggers a
 * refresh. Returns a ref callback to pass to the FlatList/ScrollView.
 * No-op on native (the built-in RefreshControl handles it there).
 */
export function useWebPullToRefresh(onRefresh: () => void, threshold = 100) {
  const cleanup = useRef<(() => void) | null>(null);
  const refreshRef = useRef(onRefresh);
  refreshRef.current = onRefresh;

  return useCallback(
    (instance: any) => {
      cleanup.current?.();
      cleanup.current = null;

      if (Platform.OS !== "web" || !instance) return;

      const node =
        instance.getScrollableNode?.() ??
        instance.getScrollResponder?.()?.getScrollableNode?.() ??
        null;

      if (!node || typeof node.addEventListener !== "function") return;

      let startY = 0;
      let pulling = false;

      const start = (e: any) => {
        startY = e.touches?.[0]?.clientY ?? 0;
        pulling = false;
      };
      const move = (e: any) => {
        const y = e.touches?.[0]?.clientY ?? 0;
        if ((node.scrollTop ?? 0) <= 0 && y - startY > threshold) {
          pulling = true;
        }
      };
      const end = () => {
        if (pulling) {
          pulling = false;
          refreshRef.current();
        }
      };

      node.addEventListener("touchstart", start, { passive: true });
      node.addEventListener("touchmove", move, { passive: true });
      node.addEventListener("touchend", end, { passive: true });
      node.addEventListener("touchcancel", end, { passive: true });

      cleanup.current = () => {
        node.removeEventListener("touchstart", start);
        node.removeEventListener("touchmove", move);
        node.removeEventListener("touchend", end);
        node.removeEventListener("touchcancel", end);
      };
    },
    [threshold]
  );
}
