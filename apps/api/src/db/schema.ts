import { pgTable, index, uuid, text, integer, timestamp, uniqueIndex, boolean, foreignKey, jsonb, doublePrecision } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const otpChallenges = pgTable("otp_challenges", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	channel: text().notNull(),
	identifier: text().notNull(),
	purpose: text().default('login').notNull(),
	codeHash: text("code_hash").notNull(),
	attempts: integer().default(0).notNull(),
	maxAttempts: integer("max_attempts").default(5).notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).notNull(),
	consumedAt: timestamp("consumed_at", { withTimezone: true, mode: 'string' }),
	requestIp: text("request_ip"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("otp_challenges_expires_idx").using("btree", table.expiresAt.asc().nullsLast().op("timestamptz_ops")),
	index("otp_challenges_identifier_idx").using("btree", table.identifier.asc().nullsLast().op("text_ops"), table.createdAt.asc().nullsLast().op("text_ops")),
]);

export const users = pgTable("users", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: text(),
	phone: text(),
	email: text(),
	status: text().default('active').notNull(),
	isGuest: boolean("is_guest").default(false).notNull(),
	lastActiveAt: timestamp("last_active_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("users_email_unique").using("btree", table.email.asc().nullsLast().op("text_ops")),
	uniqueIndex("users_phone_unique").using("btree", table.phone.asc().nullsLast().op("text_ops")),
]);

export const analyticsEvents = pgTable("analytics_events", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id"),
	name: text().notNull(),
	properties: jsonb().default({}).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("analytics_events_name_idx").using("btree", table.name.asc().nullsLast().op("text_ops"), table.createdAt.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "analytics_events_user_id_users_id_fk"
		}).onDelete("set null"),
]);

export const auditLogs = pgTable("audit_logs", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	actorUserId: uuid("actor_user_id"),
	action: text().notNull(),
	entityType: text("entity_type").notNull(),
	entityId: text("entity_id"),
	metadata: jsonb().default({}).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("audit_logs_action_idx").using("btree", table.action.asc().nullsLast().op("text_ops"), table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	index("audit_logs_entity_idx").using("btree", table.entityType.asc().nullsLast().op("text_ops"), table.entityId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.actorUserId],
			foreignColumns: [users.id],
			name: "audit_logs_actor_user_id_users_id_fk"
		}).onDelete("set null"),
]);

export const deviceTokens = pgTable("device_tokens", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	token: text().notNull(),
	platform: text().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	lastSeenAt: timestamp("last_seen_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	uniqueIndex("device_tokens_token_unique").using("btree", table.token.asc().nullsLast().op("text_ops")),
	index("device_tokens_user_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "device_tokens_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const fighterProfiles = pgTable("fighter_profiles", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	name: text().notNull(),
	city: text().notNull(),
	state: text().notNull(),
	latitude: doublePrecision(),
	longitude: doublePrecision(),
	ageYears: integer("age_years"),
	heightCm: doublePrecision("height_cm"),
	weightKg: doublePrecision("weight_kg"),
	yearsExperience: integer("years_experience").default(0).notNull(),
	totalAmateurFights: integer("total_amateur_fights").default(0).notNull(),
	totalProFights: integer("total_pro_fights").default(0).notNull(),
	weightClass: text("weight_class").notNull(),
	skillLevel: text("skill_level").notNull(),
	bio: text(),
	avatarUrl: text("avatar_url"),
	gymId: uuid("gym_id"),
	verificationStatus: text("verification_status").default('unverified').notNull(),
	isPublic: boolean("is_public").default(true).notNull(),
	lastActiveAt: timestamp("last_active_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("fighter_profiles_city_idx").using("btree", table.city.asc().nullsLast().op("text_ops")),
	index("fighter_profiles_last_active_idx").using("btree", table.lastActiveAt.asc().nullsLast().op("timestamptz_ops")),
	index("fighter_profiles_lat_lng_idx").using("btree", table.latitude.asc().nullsLast().op("float8_ops"), table.longitude.asc().nullsLast().op("float8_ops")),
	index("fighter_profiles_skill_idx").using("btree", table.skillLevel.asc().nullsLast().op("text_ops")),
	uniqueIndex("fighter_profiles_user_unique").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	index("fighter_profiles_weight_class_idx").using("btree", table.weightClass.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.gymId],
			foreignColumns: [gymProfiles.id],
			name: "fighter_profiles_gym_id_gym_profiles_id_fk"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "fighter_profiles_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const fighterDisciplines = pgTable("fighter_disciplines", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	fighterId: uuid("fighter_id").notNull(),
	discipline: text().notNull(),
}, (table) => [
	index("fighter_disciplines_discipline_idx").using("btree", table.discipline.asc().nullsLast().op("text_ops")),
	uniqueIndex("fighter_disciplines_unique").using("btree", table.fighterId.asc().nullsLast().op("text_ops"), table.discipline.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.fighterId],
			foreignColumns: [fighterProfiles.id],
			name: "fighter_disciplines_fighter_id_fighter_profiles_id_fk"
		}).onDelete("cascade"),
]);

export const gymProfiles = pgTable("gym_profiles", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	ownerUserId: uuid("owner_user_id").notNull(),
	name: text().notNull(),
	ownerName: text("owner_name"),
	phone: text(),
	email: text(),
	description: text(),
	address: text().notNull(),
	city: text().notNull(),
	state: text().notNull(),
	pincode: text(),
	latitude: doublePrecision(),
	longitude: doublePrecision(),
	timings: text(),
	monthlyFeePaise: integer("monthly_fee_paise"),
	hasTrialClass: boolean("has_trial_class").default(false).notNull(),
	photoUrls: jsonb("photo_urls").default([]).notNull(),
	coverPhotoUrl: text("cover_photo_url"),
	status: text().default('draft').notNull(),
	verificationStatus: text("verification_status").default('pending').notNull(),
	listingFeePaymentId: uuid("listing_fee_payment_id"),
	subscriptionFailedAt: timestamp("subscription_failed_at", { withTimezone: true, mode: 'string' }),
	listedAt: timestamp("listed_at", { withTimezone: true, mode: 'string' }),
	verifiedAt: timestamp("verified_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("gym_profiles_city_idx").using("btree", table.city.asc().nullsLast().op("text_ops")),
	index("gym_profiles_lat_lng_idx").using("btree", table.latitude.asc().nullsLast().op("float8_ops"), table.longitude.asc().nullsLast().op("float8_ops")),
	index("gym_profiles_owner_idx").using("btree", table.ownerUserId.asc().nullsLast().op("uuid_ops")),
	index("gym_profiles_status_idx").using("btree", table.status.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.ownerUserId],
			foreignColumns: [users.id],
			name: "gym_profiles_owner_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const gymDisciplines = pgTable("gym_disciplines", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	gymId: uuid("gym_id").notNull(),
	discipline: text().notNull(),
}, (table) => [
	index("gym_disciplines_discipline_idx").using("btree", table.discipline.asc().nullsLast().op("text_ops")),
	uniqueIndex("gym_disciplines_unique").using("btree", table.gymId.asc().nullsLast().op("text_ops"), table.discipline.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.gymId],
			foreignColumns: [gymProfiles.id],
			name: "gym_disciplines_gym_id_gym_profiles_id_fk"
		}).onDelete("cascade"),
]);

export const gymMemberships = pgTable("gym_memberships", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	gymId: uuid("gym_id").notNull(),
	fighterUserId: uuid("fighter_user_id").notNull(),
	paymentId: uuid("payment_id"),
	providerPaymentId: text("provider_payment_id"),
	providerOrderId: text("provider_order_id"),
	amountPaise: integer("amount_paise").notNull(),
	currency: text().default('INR').notNull(),
	status: text().default('pending_payment').notNull(),
	startedAt: timestamp("started_at", { withTimezone: true, mode: 'string' }),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("gym_memberships_fighter_idx").using("btree", table.fighterUserId.asc().nullsLast().op("text_ops"), table.status.asc().nullsLast().op("uuid_ops")),
	index("gym_memberships_gym_idx").using("btree", table.gymId.asc().nullsLast().op("text_ops"), table.status.asc().nullsLast().op("uuid_ops")),
	uniqueIndex("gym_memberships_provider_payment_unique").using("btree", table.providerPaymentId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.fighterUserId],
			foreignColumns: [users.id],
			name: "gym_memberships_fighter_user_id_users_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.gymId],
			foreignColumns: [gymProfiles.id],
			name: "gym_memberships_gym_id_gym_profiles_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.paymentId],
			foreignColumns: [payments.id],
			name: "gym_memberships_payment_id_payments_id_fk"
		}).onDelete("set null"),
]);

export const gymMembershipRequests = pgTable("gym_membership_requests", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	membershipId: uuid("membership_id").notNull(),
	gymId: uuid("gym_id").notNull(),
	fighterUserId: uuid("fighter_user_id").notNull(),
	status: text().default('pending').notNull(),
	respondedAt: timestamp("responded_at", { withTimezone: true, mode: 'string' }),
	respondedByUserId: uuid("responded_by_user_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("gym_membership_requests_fighter_idx").using("btree", table.fighterUserId.asc().nullsLast().op("uuid_ops")),
	index("gym_membership_requests_gym_status_idx").using("btree", table.gymId.asc().nullsLast().op("text_ops"), table.status.asc().nullsLast().op("text_ops")),
	uniqueIndex("gym_membership_requests_membership_unique").using("btree", table.membershipId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.fighterUserId],
			foreignColumns: [users.id],
			name: "gym_membership_requests_fighter_user_id_users_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.gymId],
			foreignColumns: [gymProfiles.id],
			name: "gym_membership_requests_gym_id_gym_profiles_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.membershipId],
			foreignColumns: [gymMemberships.id],
			name: "gym_membership_requests_membership_id_gym_memberships_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.respondedByUserId],
			foreignColumns: [users.id],
			name: "gym_membership_requests_responded_by_user_id_users_id_fk"
		}).onDelete("set null"),
]);

export const payments = pgTable("payments", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	gymId: uuid("gym_id"),
	fighterUserId: uuid("fighter_user_id"),
	type: text().notNull(),
	amountPaise: integer("amount_paise").notNull(),
	currency: text().default('INR').notNull(),
	provider: text().default('razorpay').notNull(),
	providerOrderId: text("provider_order_id"),
	providerPaymentId: text("provider_payment_id"),
	providerSubscriptionId: text("provider_subscription_id"),
	status: text().default('created').notNull(),
	metadata: jsonb().default({}).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("payments_gym_idx").using("btree", table.gymId.asc().nullsLast().op("uuid_ops"), table.createdAt.asc().nullsLast().op("uuid_ops")),
	uniqueIndex("payments_provider_order_unique").using("btree", table.providerOrderId.asc().nullsLast().op("text_ops")),
	uniqueIndex("payments_provider_payment_unique").using("btree", table.providerPaymentId.asc().nullsLast().op("text_ops")),
	index("payments_status_idx").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("payments_type_idx").using("btree", table.type.asc().nullsLast().op("text_ops")),
	index("payments_user_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops"), table.createdAt.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.fighterUserId],
			foreignColumns: [users.id],
			name: "payments_fighter_user_id_users_id_fk"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.gymId],
			foreignColumns: [gymProfiles.id],
			name: "payments_gym_id_gym_profiles_id_fk"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "payments_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const gymOwners = pgTable("gym_owners", {
	userId: uuid("user_id").primaryKey().notNull(),
	verificationStatus: text("verification_status").default('pending').notNull(),
	businessName: text("business_name"),
	businessPhone: text("business_phone"),
	businessEmail: text("business_email"),
	razorpayLinkedAccountId: text("razorpay_linked_account_id"),
	razorpayOnboardingStatus: text("razorpay_onboarding_status").default('not_started').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("gym_owners_linked_account_idx").using("btree", table.razorpayLinkedAccountId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "gym_owners_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const gymVerification = pgTable("gym_verification", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	gymId: uuid("gym_id").notNull(),
	status: text().notNull(),
	reason: text(),
	reviewedByUserId: uuid("reviewed_by_user_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("gym_verification_gym_idx").using("btree", table.gymId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	foreignKey({
			columns: [table.gymId],
			foreignColumns: [gymProfiles.id],
			name: "gym_verification_gym_id_gym_profiles_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.reviewedByUserId],
			foreignColumns: [users.id],
			name: "gym_verification_reviewed_by_user_id_users_id_fk"
		}).onDelete("set null"),
]);

export const sparringRequests = pgTable("sparring_requests", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	senderId: uuid("sender_id").notNull(),
	receiverId: uuid("receiver_id").notNull(),
	discipline: text().notNull(),
	proposedDate: timestamp("proposed_date", { withTimezone: true, mode: 'string' }).notNull(),
	proposedLocation: text("proposed_location").notNull(),
	message: text(),
	status: text().default('pending').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("sparring_requests_receiver_idx").using("btree", table.receiverId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	index("sparring_requests_sender_idx").using("btree", table.senderId.asc().nullsLast().op("uuid_ops"), table.createdAt.asc().nullsLast().op("uuid_ops")),
	index("sparring_requests_status_idx").using("btree", table.status.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.receiverId],
			foreignColumns: [users.id],
			name: "sparring_requests_receiver_id_users_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.senderId],
			foreignColumns: [users.id],
			name: "sparring_requests_sender_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const messages = pgTable("messages", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	matchId: uuid("match_id").notNull(),
	senderId: uuid("sender_id").notNull(),
	content: text().notNull(),
	readAt: timestamp("read_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("messages_match_created_idx").using("btree", table.matchId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	index("messages_sender_idx").using("btree", table.senderId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.matchId],
			foreignColumns: [sparringRequests.id],
			name: "messages_match_id_sparring_requests_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.senderId],
			foreignColumns: [users.id],
			name: "messages_sender_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const notifications = pgTable("notifications", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	type: text().notNull(),
	title: text().notNull(),
	body: text().notNull(),
	data: jsonb().default({}).notNull(),
	readAt: timestamp("read_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("notifications_user_idx").using("btree", table.userId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "notifications_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const paymentEvents = pgTable("payment_events", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	providerEventId: text("provider_event_id"),
	eventType: text("event_type").notNull(),
	paymentId: uuid("payment_id"),
	payload: jsonb().default({}).notNull(),
	signatureVerified: boolean("signature_verified").default(false).notNull(),
	processedAt: timestamp("processed_at", { withTimezone: true, mode: 'string' }),
	processingError: text("processing_error"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("payment_events_payment_idx").using("btree", table.paymentId.asc().nullsLast().op("uuid_ops")),
	uniqueIndex("payment_events_provider_event_unique").using("btree", table.providerEventId.asc().nullsLast().op("text_ops")),
	index("payment_events_type_idx").using("btree", table.eventType.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.paymentId],
			foreignColumns: [payments.id],
			name: "payment_events_payment_id_payments_id_fk"
		}).onDelete("set null"),
]);

export const paymentTransfers = pgTable("payment_transfers", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	paymentId: uuid("payment_id").notNull(),
	providerTransferId: text("provider_transfer_id"),
	linkedAccountId: text("linked_account_id").notNull(),
	amountPaise: integer("amount_paise").notNull(),
	currency: text().default('INR').notNull(),
	status: text().default('created').notNull(),
	failureReason: text("failure_reason"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("payment_transfers_payment_idx").using("btree", table.paymentId.asc().nullsLast().op("uuid_ops")),
	uniqueIndex("payment_transfers_provider_unique").using("btree", table.providerTransferId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.paymentId],
			foreignColumns: [payments.id],
			name: "payment_transfers_payment_id_payments_id_fk"
		}).onDelete("cascade"),
]);

export const refunds = pgTable("refunds", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	paymentId: uuid("payment_id").notNull(),
	providerRefundId: text("provider_refund_id"),
	amountPaise: integer("amount_paise").notNull(),
	status: text().default('created').notNull(),
	reason: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("refunds_payment_idx").using("btree", table.paymentId.asc().nullsLast().op("uuid_ops")),
	uniqueIndex("refunds_provider_unique").using("btree", table.providerRefundId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.paymentId],
			foreignColumns: [payments.id],
			name: "refunds_payment_id_payments_id_fk"
		}).onDelete("cascade"),
]);

export const sessions = pgTable("sessions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	refreshTokenHash: text("refresh_token_hash").notNull(),
	userAgent: text("user_agent"),
	ip: text(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).notNull(),
	revokedAt: timestamp("revoked_at", { withTimezone: true, mode: 'string' }),
	lastUsedAt: timestamp("last_used_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("sessions_refresh_hash_unique").using("btree", table.refreshTokenHash.asc().nullsLast().op("text_ops")),
	index("sessions_user_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "sessions_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const subscriptions = pgTable("subscriptions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	gymId: uuid("gym_id"),
	type: text().notNull(),
	providerPlanId: text("provider_plan_id"),
	providerSubscriptionId: text("provider_subscription_id"),
	status: text().default('pending').notNull(),
	rawProviderStatus: text("raw_provider_status"),
	currentPeriodStart: timestamp("current_period_start", { withTimezone: true, mode: 'string' }),
	currentPeriodEnd: timestamp("current_period_end", { withTimezone: true, mode: 'string' }),
	cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("subscriptions_gym_idx").using("btree", table.gymId.asc().nullsLast().op("uuid_ops")),
	uniqueIndex("subscriptions_provider_unique").using("btree", table.providerSubscriptionId.asc().nullsLast().op("text_ops")),
	index("subscriptions_status_idx").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("subscriptions_user_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.gymId],
			foreignColumns: [gymProfiles.id],
			name: "subscriptions_gym_id_gym_profiles_id_fk"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "subscriptions_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const userBlocks = pgTable("user_blocks", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	blockerUserId: uuid("blocker_user_id").notNull(),
	blockedUserId: uuid("blocked_user_id").notNull(),
	reason: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("user_blocks_blocked_idx").using("btree", table.blockedUserId.asc().nullsLast().op("uuid_ops")),
	uniqueIndex("user_blocks_unique").using("btree", table.blockerUserId.asc().nullsLast().op("uuid_ops"), table.blockedUserId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.blockedUserId],
			foreignColumns: [users.id],
			name: "user_blocks_blocked_user_id_users_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.blockerUserId],
			foreignColumns: [users.id],
			name: "user_blocks_blocker_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const userReports = pgTable("user_reports", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	reporterUserId: uuid("reporter_user_id").notNull(),
	reportedUserId: uuid("reported_user_id").notNull(),
	reason: text().notNull(),
	details: text(),
	status: text().default('open').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("user_reports_reported_idx").using("btree", table.reportedUserId.asc().nullsLast().op("text_ops"), table.status.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.reportedUserId],
			foreignColumns: [users.id],
			name: "user_reports_reported_user_id_users_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.reporterUserId],
			foreignColumns: [users.id],
			name: "user_reports_reporter_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const userRoles = pgTable("user_roles", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	role: text().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("user_roles_user_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	uniqueIndex("user_roles_user_role_unique").using("btree", table.userId.asc().nullsLast().op("text_ops"), table.role.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_roles_user_id_users_id_fk"
		}).onDelete("cascade"),
]);
