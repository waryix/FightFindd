function fmtTs(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) {
    return value.toISOString().slice(0, 19).replace("T", " ");
  }
  if (typeof value === "string") {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) {
      return d.toISOString().slice(0, 19).replace("T", " ");
    }
    return value;
  }
  return null;
}

export interface FighterParts {
  user: any;
  profile?: any | null;
  disciplines?: string[];
  pushToken?: string | null;
  isPro?: boolean;
}

export function mapFighter({
  user,
  profile,
  disciplines = [],
  pushToken = null,
  isPro = false,
}: FighterParts) {
  return {
    id: user.id,
    name: profile?.name ?? user.name ?? "",
    phone: user.phone ?? null,
    email: user.email ?? null,
    city: profile?.city ?? null,
    state: profile?.state ?? null,
    latitude: profile?.latitude ?? null,
    longitude: profile?.longitude ?? null,
    discipline: disciplines,
    skill_level: profile?.skillLevel ?? null,
    weight_class: profile?.weightClass ?? null,
    age_years: profile?.ageYears ?? 0,
    years_experience: profile?.yearsExperience ?? 0,
    height_cm: profile?.heightCm ?? null,
    weight_kg: profile?.weightKg ?? null,
    total_amateur_fights: profile?.totalAmateurFights ?? 0,
    total_pro_fights: profile?.totalProFights ?? 0,
    bio: profile?.bio ?? null,
    avatar_url: profile?.avatarUrl ?? null,
    push_token: pushToken,
    gym_id: profile?.gymId ?? null,
    is_verified: profile?.verificationStatus === "verified" ? 1 : 0,
    is_pro: isPro ? 1 : 0,
    created_at: fmtTs(profile?.createdAt ?? user.createdAt),
    updated_at: fmtTs(profile?.updatedAt ?? null),
  };
}

export interface GymParts {
  gym: any;
  disciplines?: string[];
  ownerEmail?: string | null;
  registrationPaid?: boolean;
  paymentId?: string | null;
  monthlyStatus?: string;
  nextBillingAt?: unknown;
}

export function mapGym({
  gym,
  disciplines = [],
  ownerEmail = null,
  registrationPaid = false,
  paymentId = null,
  monthlyStatus = "inactive",
  nextBillingAt = null,
}: GymParts) {
  return {
    id: gym.id,
    name: gym.name,
    owner_name: gym.ownerName ?? null,
    owner_email: ownerEmail,
    phone: gym.phone ?? null,
    email: gym.email ?? null,
    address: gym.address ?? null,
    city: gym.city ?? null,
    state: gym.state ?? null,
    pincode: gym.pincode ?? null,
    latitude: gym.latitude ?? null,
    longitude: gym.longitude ?? null,
    disciplines,
    monthly_fee_inr:
      gym.monthlyFeePaise == null ? null : Math.round(gym.monthlyFeePaise / 100),
    has_trial_class: gym.hasTrialClass ? 1 : 0,
    timings: gym.timings ?? null,
    description: gym.description ?? null,
    photo_urls: gym.photoUrls ?? [],
    is_verified: gym.verificationStatus === "verified" ? 1 : 0,
    registration_paid: registrationPaid ? 1 : 0,
    monthly_status: monthlyStatus,
    next_billing_at: fmtTs(nextBillingAt),
    last_payment_id: paymentId,
    created_at: fmtTs(gym.createdAt),
    updated_at: fmtTs(gym.updatedAt),
  };
}

export function mapSparring(row: any) {
  if (!row) return row;
  return {
    id: row.id,
    sender_id: row.senderId,
    receiver_id: row.receiverId,
    discipline: row.discipline,
    proposed_date: fmtTs(row.proposedDate),
    proposed_location: row.proposedLocation,
    message: row.message,
    status: row.status,
    created_at: fmtTs(row.createdAt),
    updated_at: fmtTs(row.updatedAt),
  };
}

export function mapMessage(row: any) {
  if (!row) return row;
  return {
    id: row.id,
    match_id: row.matchId,
    sender_id: row.senderId,
    content: row.content,
    read_at: fmtTs(row.readAt),
    created_at: fmtTs(row.createdAt),
  };
}
