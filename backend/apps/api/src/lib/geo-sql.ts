import { sql, type SQL } from "drizzle-orm";

/**
 * Haversine distance expression in SQL (kilometres). Filtering and sorting
 * happen in PostgreSQL — never by loading rows into Node.
 * Returns NULL when a row has no coordinates.
 */
export function distanceKmSql(
  latColumn: SQL | unknown,
  lngColumn: SQL | unknown,
  lat: number,
  lng: number,
): SQL<number> {
  return sql<number>`(
    6371.0088 * 2 * asin(
      least(1, sqrt(
        power(sin(radians((${latColumn} - ${lat}) / 2)), 2) +
        cos(radians(${lat})) * cos(radians(${latColumn})) *
        power(sin(radians((${lngColumn} - ${lng}) / 2)), 2)
      ))
    )
  )`;
}

/** Cheap bounding-box prefilter that can use the (lat, lng) btree indexes. */
export function boundingBoxSql(
  latColumn: SQL | unknown,
  lngColumn: SQL | unknown,
  lat: number,
  lng: number,
  radiusKm: number,
): SQL {
  const latDelta = radiusKm / 111.32;
  const cosLat = Math.cos((lat * Math.PI) / 180);
  const lonDelta = Math.abs(cosLat) < 1e-9 ? 180 : radiusKm / (111.32 * Math.abs(cosLat));
  return sql`(
    ${latColumn} is not null and ${lngColumn} is not null
    and ${latColumn} between ${lat - latDelta} and ${lat + latDelta}
    and ${lngColumn} between ${lng - lonDelta} and ${lng + lonDelta}
  )`;
}

export function withinRadiusSql(distanceExpression: SQL<number>, radiusKm: number): SQL {
  return sql`${distanceExpression} <= ${radiusKm}`;
}
