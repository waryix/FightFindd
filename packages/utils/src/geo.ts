const EARTH_RADIUS_KM = 6371.0088;

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance between two coordinates in kilometres. */
export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function isWithinRadius(
  lat: number,
  lon: number,
  centerLat: number,
  centerLon: number,
  radiusKm: number,
): boolean {
  return distanceKm(lat, lon, centerLat, centerLon) <= radiusKm;
}

/**
 * Bounding box used for cheap database-side pre-filtering before an exact
 * haversine expression is applied. Overestimates slightly at the edges, which
 * is fine because the SQL layer still applies the precise distance filter.
 */
export function boundingBox(lat: number, lon: number, radiusKm: number) {
  const latDelta = radiusKm / 111.32;
  const cosLat = Math.cos(toRad(lat));
  const lonDelta = cosLat < 1e-9 ? 180 : radiusKm / (111.32 * cosLat);
  return {
    minLat: Math.max(-90, lat - latDelta),
    maxLat: Math.min(90, lat + latDelta),
    minLon: Math.max(-180, lon - lonDelta),
    maxLon: Math.min(180, lon + lonDelta),
  };
}

/** Rounded, human-friendly distance label ("2.4 km", "800 m"). */
export function formatDistance(km: number): string {
  if (km < 1) return `${Math.max(50, Math.round(km * 1000 / 50) * 50)} m`;
  return `${km.toFixed(km < 10 ? 1 : 0)} km`;
}

/**
 * Distance component of the compatibility score (0..1).
 * Falls back to a neutral value when either side has no coordinates.
 */
export function distanceScore(distance: number | null, maxReferenceKm = 50): number {
  if (distance === null || !Number.isFinite(distance)) return 0.5;
  if (distance <= 0) return 1;
  return Math.max(0, Math.min(1, 1 - distance / maxReferenceKm));
}
