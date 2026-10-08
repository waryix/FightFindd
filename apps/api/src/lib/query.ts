const SNAKE_TO_CAMEL: Record<string, string> = {
  radius_km: "radiusKm",
  weight_class: "weightClass",
  skill_level: "skill",
  min_height: "minHeight",
  max_height: "maxHeight",
  min_weight: "minWeight",
  max_weight: "maxWeight",
  min_experience: "minExperience",
  max_experience: "maxExperience",
  min_fights: "minFights",
  max_fights: "maxFights",
  has_trial: "hasTrial",
  verified_only: "verifiedOnly",
  min_fee_paise: "minFeePaise",
  max_fee_paise: "maxFeePaise",
  unread_only: "unreadOnly",
};

/**
 * Query strings use snake_case (per the public API docs) while internal
 * schemas use camelCase. Accept both; explicit camelCase wins.
 */
export function normalizeQuery(query: unknown): Record<string, unknown> {
  if (!query || typeof query !== "object") return {};
  const source = query as Record<string, unknown>;
  const out: Record<string, unknown> = { ...source };
  for (const [snake, camel] of Object.entries(SNAKE_TO_CAMEL)) {
    if (source[snake] !== undefined && source[camel] === undefined) out[camel] = source[snake];
  }
  return out;
}
