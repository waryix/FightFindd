import { useCallback, useState } from "react";
import * as Location from "expo-location";
import { track } from "../analytics";

export interface Coords {
  lat: number;
  lng: number;
}

export type LocationStatus = "unknown" | "granted" | "denied" | "unavailable";

export function useDeviceLocation() {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [status, setStatus] = useState<LocationStatus>("unknown");
  const [loading, setLoading] = useState(false);

  const request = useCallback(async (): Promise<Coords | null> => {
    setLoading(true);
    try {
      const { status: permission } = await Location.requestForegroundPermissionsAsync();
      if (permission !== "granted") {
        setStatus("denied");
        return null;
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const next = { lat: position.coords.latitude, lng: position.coords.longitude };
      setCoords(next);
      setStatus("granted");
      track("location_permission_granted");
      return next;
    } catch {
      setStatus("unavailable");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    setCoords(null);
    setStatus("unknown");
  }, []);

  return { coords, status, loading, request, clear };
}
