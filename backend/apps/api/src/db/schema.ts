import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name"),
    phone: text("phone"),
    email: text("email"),
    status: text("status").notNull().default("active"), // active | suspended | deleted
    isGuest: boolean("is_guest").notNull().default(false),
    lastActiveAt: timestamp("last_active_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("users_phone_unique").on(table.phone),
    uniqueIndex("users_email_unique").on(table.email),
  ],
);

export const userRoles = pgTable(
  "user_roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull(), // FIGHTER | GYM_OWNER | ADMIN
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("user_roles_user_role_unique").on(table.userId, table.role),
    index("user_roles_user_idx").on(table.userId),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    refreshTokenHash: text("refresh_token_hash").notNull(),
    userAgent: text("user_agent"),
    ip: text("ip"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("sessions_refresh_hash_unique").on(table.refreshTokenHash),
    index("sessions_user_idx").on(table.userId),
  ],
);

export const otpChallenges = pgTable(
  "otp_challenges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    channel: text("channel").notNull(), // phone | email
    identifier: text("identifier").notNull(),
    purpose: text("purpose").notNull().default("login"),
    codeHash: text("code_hash").notNull(),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(5),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    requestIp: text("request_ip"),
    createdAt: createdAt(),
  },
  (table) => [
    index("otp_challenges_identifier_idx").on(table.identifier, table.createdAt),
    index("otp_challenges_expires_idx").on(table.expiresAt),
  ],
);

export const fighterProfiles = pgTable(
  "fighter_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    city: text("city").notNull(),
    state: text("state").notNull(),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    ageYears: integer("age_years"),
    heightCm: doublePrecision("height_cm"),
    weightKg: doublePrecision("weight_kg"),
    yearsExperience: integer("years_experience").notNull().default(0),
    totalAmateurFights: integer("total_amateur_fights").notNull().default(0),
    totalProFights: integer("total_pro_fights").notNull().default(0),
    weightClass: text("weight_class").notNull(),
    skillLevel: text("skill_level").notNull(),
    bio: text("bio"),
    avatarUrl: text("avatar_url"),
    gymId: uuid("gym_id").references(() => gymProfiles.id, { onDelete: "set null" }),
    verificationStatus: text("verification_status").notNull().default("unverified"),
    isPublic: boolean("is_public").notNull().default(true),
    lastActiveAt: timestamp("last_active_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("fighter_profiles_user_unique").on(table.userId),
    index("fighter_profiles_lat_lng_idx").on(table.latitude, table.longitude),
    index("fighter_profiles_city_idx").on(table.city),
    index("fighter_profiles_skill_idx").on(table.skillLevel),
    index("fighter_profiles_weight_class_idx").on(table.weightClass),
    index("fighter_profiles_last_active_idx").on(table.lastActiveAt),
  ],
);

export const fighterDisciplines = pgTable(
  "fighter_disciplines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fighterId: uuid("fighter_id")
      .notNull()
      .references(() => fighterProfiles.id, { onDelete: "cascade" }),
    discipline: text("discipline").notNull(),
  },
  (table) => [
    uniqueIndex("fighter_disciplines_unique").on(table.fighterId, table.discipline),
    index("fighter_disciplines_discipline_idx").on(table.discipline),
  ],
);

export const gymOwners = pgTable(
  "gym_owners",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    verificationStatus: text("verification_status").notNull().default("pending"),
    businessName: text("business_name"),
    businessPhone: text("business_phone"),
    businessEmail: text("business_email"),
    razorpayLinkedAccountId: text("razorpay_linked_account_id"),
    razorpayOnboardingStatus: text("razorpay_onboarding_status").notNull().default("not_started"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("gym_owners_linked_account_idx").on(table.razorpayLinkedAccountId)],
);

export const gymProfiles = pgTable(
  "gym_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    ownerName: text("owner_name"),
    phone: text("phone"),
    email: text("email"),
    description: text("description"),
    address: text("address").notNull(),
    city: text("city").notNull(),
    state: text("state").notNull(),
    pincode: text("pincode"),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    timings: text("timings"),
    monthlyFeePaise: integer("monthly_fee_paise"),
    hasTrialClass: boolean("has_trial_class").notNull().default(false),
    photoUrls: jsonb("photo_urls").$type<string[]>().notNull().default([]),
    coverPhotoUrl: text("cover_photo_url"),
    status: text("status").notNull().default("draft"),
    verificationStatus: text("verification_status").notNull().default("pending"),
    listingFeePaymentId: uuid("listing_fee_payment_id"),
    subscriptionFailedAt: timestamp("subscription_failed_at", { withTimezone: true }),
    listedAt: timestamp("listed_at", { withTimezone: true }),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("gym_profiles_owner_idx").on(table.ownerUserId),
    index("gym_profiles_lat_lng_idx").on(table.latitude, table.longitude),
    index("gym_profiles_city_idx").on(table.city),
    index("gym_profiles_status_idx").on(table.status),
  ],
);

export const gymDisciplines = pgTable(
  "gym_disciplines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gymId: uuid("gym_id")
      .notNull()
      .references(() => gymProfiles.id, { onDelete: "cascade" }),
    discipline: text("discipline").notNull(),
  },
  (table) => [
    uniqueIndex("gym_disciplines_unique").on(table.gymId, table.discipline),
    index("gym_disciplines_discipline_idx").on(table.discipline),
  ],
);

export const gymVerification = pgTable(
  "gym_verification",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gymId: uuid("gym_id")
      .notNull()
      .references(() => gymProfiles.id, { onDelete: "cascade" }),
    status: text("status").notNull(),
    reason: text("reason"),
    reviewedByUserId: uuid("reviewed_by_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (table) => [index("gym_verification_gym_idx").on(table.gymId, table.createdAt)],
);

export const sparringRequests = pgTable(
  "sparring_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    senderId: uuid("sender_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    receiverId: uuid("receiver_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    discipline: text("discipline").notNull(),
    proposedDate: timestamp("proposed_date", { withTimezone: true }).notNull(),
    proposedLocation: text("proposed_location").notNull(),
    message: text("message"),
    status: text("status").notNull().default("pending"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("sparring_requests_sender_idx").on(table.senderId, table.createdAt),
    index("sparring_requests_receiver_idx").on(table.receiverId, table.createdAt),
    index("sparring_requests_status_idx").on(table.status),
  ],
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    matchId: uuid("match_id")
      .notNull()
      .references(() => sparringRequests.id, { onDelete: "cascade" }),
    senderId: uuid("sender_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (table) => [
    index("messages_match_created_idx").on(table.matchId, table.createdAt),
    index("messages_sender_idx").on(table.senderId),
  ],
);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    gymId: uuid("gym_id").references(() => gymProfiles.id, { onDelete: "set null" }),
    fighterUserId: uuid("fighter_user_id").references(() => users.id, { onDelete: "set null" }),
    type: text("type").notNull(), // FIGHTER_UPGRADE | GYM_LISTING | GYM_PLATFORM_SUBSCRIPTION | GYM_MEMBERSHIP
    amountPaise: integer("amount_paise").notNull(),
    currency: text("currency").notNull().default("INR"),
    provider: text("provider").notNull().default("razorpay"),
    providerOrderId: text("provider_order_id"),
    providerPaymentId: text("provider_payment_id"),
    providerSubscriptionId: text("provider_subscription_id"),
    status: text("status").notNull().default("created"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("payments_provider_order_unique").on(table.providerOrderId),
    uniqueIndex("payments_provider_payment_unique").on(table.providerPaymentId),
    index("payments_user_idx").on(table.userId, table.createdAt),
    index("payments_gym_idx").on(table.gymId, table.createdAt),
    index("payments_status_idx").on(table.status),
    index("payments_type_idx").on(table.type),
  ],
);

export const paymentEvents = pgTable(
  "payment_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    providerEventId: text("provider_event_id"),
    eventType: text("event_type").notNull(),
    paymentId: uuid("payment_id").references(() => payments.id, { onDelete: "set null" }),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    signatureVerified: boolean("signature_verified").notNull().default(false),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    processingError: text("processing_error"),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("payment_events_provider_event_unique").on(table.providerEventId),
    index("payment_events_type_idx").on(table.eventType),
    index("payment_events_payment_idx").on(table.paymentId),
  ],
);

export const paymentTransfers = pgTable(
  "payment_transfers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    paymentId: uuid("payment_id")
      .notNull()
      .references(() => payments.id, { onDelete: "cascade" }),
    providerTransferId: text("provider_transfer_id"),
    linkedAccountId: text("linked_account_id").notNull(),
    amountPaise: integer("amount_paise").notNull(),
    currency: text("currency").notNull().default("INR"),
    status: text("status").notNull().default("created"),
    failureReason: text("failure_reason"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("payment_transfers_provider_unique").on(table.providerTransferId),
    index("payment_transfers_payment_idx").on(table.paymentId),
  ],
);

export const refunds = pgTable(
  "refunds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    paymentId: uuid("payment_id")
      .notNull()
      .references(() => payments.id, { onDelete: "cascade" }),
    providerRefundId: text("provider_refund_id"),
    amountPaise: integer("amount_paise").notNull(),
    status: text("status").notNull().default("created"),
    reason: text("reason"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("refunds_provider_unique").on(table.providerRefundId),
    index("refunds_payment_idx").on(table.paymentId),
  ],
);

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    gymId: uuid("gym_id").references(() => gymProfiles.id, { onDelete: "set null" }),
    type: text("type").notNull(),
    providerPlanId: text("provider_plan_id"),
    providerSubscriptionId: text("provider_subscription_id"),
    status: text("status").notNull().default("pending"),
    rawProviderStatus: text("raw_provider_status"),
    currentPeriodStart: timestamp("current_period_start", { withTimezone: true }),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("subscriptions_provider_unique").on(table.providerSubscriptionId),
    index("subscriptions_user_idx").on(table.userId),
    index("subscriptions_gym_idx").on(table.gymId),
    index("subscriptions_status_idx").on(table.status),
  ],
);

export const gymMemberships = pgTable(
  "gym_memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gymId: uuid("gym_id")
      .notNull()
      .references(() => gymProfiles.id, { onDelete: "cascade" }),
    fighterUserId: uuid("fighter_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    paymentId: uuid("payment_id").references(() => payments.id, { onDelete: "set null" }),
    providerPaymentId: text("provider_payment_id"),
    providerOrderId: text("provider_order_id"),
    amountPaise: integer("amount_paise").notNull(),
    currency: text("currency").notNull().default("INR"),
    status: text("status").notNull().default("pending_payment"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("gym_memberships_provider_payment_unique").on(table.providerPaymentId),
    index("gym_memberships_gym_idx").on(table.gymId, table.status),
    index("gym_memberships_fighter_idx").on(table.fighterUserId, table.status),
  ],
);

export const gymMembershipRequests = pgTable(
  "gym_membership_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    membershipId: uuid("membership_id")
      .notNull()
      .references(() => gymMemberships.id, { onDelete: "cascade" }),
    gymId: uuid("gym_id")
      .notNull()
      .references(() => gymProfiles.id, { onDelete: "cascade" }),
    fighterUserId: uuid("fighter_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("pending"),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    respondedByUserId: uuid("responded_by_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("gym_membership_requests_membership_unique").on(table.membershipId),
    index("gym_membership_requests_gym_status_idx").on(table.gymId, table.status),
    index("gym_membership_requests_fighter_idx").on(table.fighterUserId),
  ],
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (table) => [index("notifications_user_idx").on(table.userId, table.createdAt)],
);

export const deviceTokens = pgTable(
  "device_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull(),
    platform: text("platform").notNull(),
    createdAt: createdAt(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("device_tokens_token_unique").on(table.token),
    index("device_tokens_user_idx").on(table.userId),
  ],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
  },
  (table) => [
    index("audit_logs_entity_idx").on(table.entityType, table.entityId),
    index("audit_logs_action_idx").on(table.action, table.createdAt),
  ],
);

export const userBlocks = pgTable(
  "user_blocks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blockerUserId: uuid("blocker_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    blockedUserId: uuid("blocked_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reason: text("reason"),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("user_blocks_unique").on(table.blockerUserId, table.blockedUserId),
    index("user_blocks_blocked_idx").on(table.blockedUserId),
  ],
);

export const userReports = pgTable(
  "user_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reporterUserId: uuid("reporter_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reportedUserId: uuid("reported_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reason: text("reason").notNull(),
    details: text("details"),
    status: text("status").notNull().default("open"),
    createdAt: createdAt(),
  },
  (table) => [index("user_reports_reported_idx").on(table.reportedUserId, table.status)],
);

export const analyticsEvents = pgTable(
  "analytics_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    properties: jsonb("properties").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
  },
  (table) => [index("analytics_events_name_idx").on(table.name, table.createdAt)],
);
