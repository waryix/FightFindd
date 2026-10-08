import { sql, type SQL } from "drizzle-orm";
import { fighterProfiles } from "../../db/schema.js";
import { distanceKmSql } from "../../lib/geo-sql.js";
import { MATCH_SCORE_WEIGHTS } from "@fightfind/types";

const CLASS_ARRAY = sql.raw(
  "array['flyweight','bantamweight','featherweight','lightweight','welterweight','middleweight','heavyweight']::text[]",
);
const SKILL_ARRAY = sql.raw("array['beginner','intermediate','advanced','professional']::text[]");

/**
 * Same weights as packages/utils/matching.ts, expressed in SQL so discovery
 * ranking, filtering and pagination all happen inside PostgreSQL.
 */
export function compatibilityScoreSql(params: {
  viewerWeightClass: string | null;
  viewerSkillLevel: string | null;
  viewerDisciplines: string[];
  lat?: number;
  lng?: number;
  maxReferenceKm?: number;
}): SQL<number> {
  const maxRef = params.maxReferenceKm ?? 50;
  // Serialize as a Postgres array literal in a single text parameter. Values
  // originate from the closed discipline enum and are escaped defensively.
  const arrLiteral = `{${params.viewerDisciplines
    .map((d) => `"${d.replace(/["\\]/g, "")}"`)
    .join(",")}}`;
  const viewerDisciplines = sql`${arrLiteral}::text[]`;

  const weight = params.viewerWeightClass
    ? sql`case
        when ${fighterProfiles.weightClass} is null then 0.5
        else (case abs(
          array_position(${CLASS_ARRAY}, ${fighterProfiles.weightClass}) -
          array_position(${CLASS_ARRAY}, ${params.viewerWeightClass})
        )
          when 0 then 1 when 1 then 0.6 when 2 then 0.3 else 0.15 end)
      end`
    : sql`0.5`;

  const skill = params.viewerSkillLevel
    ? sql`case
        when ${fighterProfiles.skillLevel} is null then 0.5
        else (case abs(
          array_position(${SKILL_ARRAY}, ${fighterProfiles.skillLevel}) -
          array_position(${SKILL_ARRAY}, ${params.viewerSkillLevel})
        )
          when 0 then 1 when 1 then 0.7 when 2 then 0.3 else 0 end)
      end`
    : sql`0.5`;

  const discipline = sql`(case
    when greatest(
      coalesce(array_length(${viewerDisciplines}, 1), 0),
      (select count(*) from fighter_disciplines fd2 where fd2.fighter_id = ${fighterProfiles.id})
    ) = 0 then 0.3
    when (
      select count(*) from fighter_disciplines fd
      where fd.fighter_id = ${fighterProfiles.id} and fd.discipline = any(${viewerDisciplines})
    ) > 0 then (
      select count(*) from fighter_disciplines fd
      where fd.fighter_id = ${fighterProfiles.id} and fd.discipline = any(${viewerDisciplines})
    )::float / greatest(
      coalesce(array_length(${viewerDisciplines}, 1), 0),
      (select count(*) from fighter_disciplines fd2 where fd2.fighter_id = ${fighterProfiles.id})
    )
    when 'mixed' = any(${viewerDisciplines}) or exists(
      select 1 from fighter_disciplines fd3
      where fd3.fighter_id = ${fighterProfiles.id} and fd3.discipline = 'mixed'
    ) then 0.5
    else 0
  end)`;

  const distance =
    params.lat !== undefined && params.lng !== undefined
      ? sql`coalesce(
          greatest(0, 1 - least(1, ${distanceKmSql(fighterProfiles.latitude, fighterProfiles.longitude, params.lat, params.lng)} / ${maxRef})),
          0.5
        )`
      : sql`0.5`;

  const activity = sql`(case
    when ${fighterProfiles.lastActiveAt} is null then 0.3
    when ${fighterProfiles.lastActiveAt} > now() - interval '3 days' then 1
    when ${fighterProfiles.lastActiveAt} > now() - interval '14 days' then 0.7
    when ${fighterProfiles.lastActiveAt} > now() - interval '45 days' then 0.4
    else 0.2
  end)`;

  return sql<number>`round(100 * (
    ${weight} * ${MATCH_SCORE_WEIGHTS.weight} +
    ${skill} * ${MATCH_SCORE_WEIGHTS.skill} +
    ${discipline} * ${MATCH_SCORE_WEIGHTS.discipline} +
    ${distance} * ${MATCH_SCORE_WEIGHTS.distance} +
    ${activity} * ${MATCH_SCORE_WEIGHTS.activity}
  ))::int`;
}

export function matchLabelForScore(score: number | null | undefined): string | null {
  if (score === null || score === undefined) return null;
  if (score >= 85) return "Great Match";
  if (score >= 70) return "Good Match";
  return "Fair Match";
}
