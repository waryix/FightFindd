import { relations } from "drizzle-orm/relations";
import { users, analyticsEvents, auditLogs, deviceTokens, gymProfiles, fighterProfiles, fighterDisciplines, gymDisciplines, gymMemberships, payments, gymMembershipRequests, gymOwners, gymVerification, sparringRequests, messages, notifications, paymentEvents, paymentTransfers, refunds, sessions, subscriptions, userBlocks, userReports, userRoles } from "./schema";

export const analyticsEventsRelations = relations(analyticsEvents, ({one}) => ({
	user: one(users, {
		fields: [analyticsEvents.userId],
		references: [users.id]
	}),
}));

export const usersRelations = relations(users, ({many}) => ({
	analyticsEvents: many(analyticsEvents),
	auditLogs: many(auditLogs),
	deviceTokens: many(deviceTokens),
	fighterProfiles: many(fighterProfiles),
	gymProfiles: many(gymProfiles),
	gymMemberships: many(gymMemberships),
	gymMembershipRequests_fighterUserId: many(gymMembershipRequests, {
		relationName: "gymMembershipRequests_fighterUserId_users_id"
	}),
	gymMembershipRequests_respondedByUserId: many(gymMembershipRequests, {
		relationName: "gymMembershipRequests_respondedByUserId_users_id"
	}),
	payments_fighterUserId: many(payments, {
		relationName: "payments_fighterUserId_users_id"
	}),
	payments_userId: many(payments, {
		relationName: "payments_userId_users_id"
	}),
	gymOwners: many(gymOwners),
	gymVerifications: many(gymVerification),
	sparringRequests_receiverId: many(sparringRequests, {
		relationName: "sparringRequests_receiverId_users_id"
	}),
	sparringRequests_senderId: many(sparringRequests, {
		relationName: "sparringRequests_senderId_users_id"
	}),
	messages: many(messages),
	notifications: many(notifications),
	sessions: many(sessions),
	subscriptions: many(subscriptions),
	userBlocks_blockedUserId: many(userBlocks, {
		relationName: "userBlocks_blockedUserId_users_id"
	}),
	userBlocks_blockerUserId: many(userBlocks, {
		relationName: "userBlocks_blockerUserId_users_id"
	}),
	userReports_reportedUserId: many(userReports, {
		relationName: "userReports_reportedUserId_users_id"
	}),
	userReports_reporterUserId: many(userReports, {
		relationName: "userReports_reporterUserId_users_id"
	}),
	userRoles: many(userRoles),
}));

export const auditLogsRelations = relations(auditLogs, ({one}) => ({
	user: one(users, {
		fields: [auditLogs.actorUserId],
		references: [users.id]
	}),
}));

export const deviceTokensRelations = relations(deviceTokens, ({one}) => ({
	user: one(users, {
		fields: [deviceTokens.userId],
		references: [users.id]
	}),
}));

export const fighterProfilesRelations = relations(fighterProfiles, ({one, many}) => ({
	gymProfile: one(gymProfiles, {
		fields: [fighterProfiles.gymId],
		references: [gymProfiles.id]
	}),
	user: one(users, {
		fields: [fighterProfiles.userId],
		references: [users.id]
	}),
	fighterDisciplines: many(fighterDisciplines),
}));

export const gymProfilesRelations = relations(gymProfiles, ({one, many}) => ({
	fighterProfiles: many(fighterProfiles),
	user: one(users, {
		fields: [gymProfiles.ownerUserId],
		references: [users.id]
	}),
	gymDisciplines: many(gymDisciplines),
	gymMemberships: many(gymMemberships),
	gymMembershipRequests: many(gymMembershipRequests),
	payments: many(payments),
	gymVerifications: many(gymVerification),
	subscriptions: many(subscriptions),
}));

export const fighterDisciplinesRelations = relations(fighterDisciplines, ({one}) => ({
	fighterProfile: one(fighterProfiles, {
		fields: [fighterDisciplines.fighterId],
		references: [fighterProfiles.id]
	}),
}));

export const gymDisciplinesRelations = relations(gymDisciplines, ({one}) => ({
	gymProfile: one(gymProfiles, {
		fields: [gymDisciplines.gymId],
		references: [gymProfiles.id]
	}),
}));

export const gymMembershipsRelations = relations(gymMemberships, ({one, many}) => ({
	user: one(users, {
		fields: [gymMemberships.fighterUserId],
		references: [users.id]
	}),
	gymProfile: one(gymProfiles, {
		fields: [gymMemberships.gymId],
		references: [gymProfiles.id]
	}),
	payment: one(payments, {
		fields: [gymMemberships.paymentId],
		references: [payments.id]
	}),
	gymMembershipRequests: many(gymMembershipRequests),
}));

export const paymentsRelations = relations(payments, ({one, many}) => ({
	gymMemberships: many(gymMemberships),
	user_fighterUserId: one(users, {
		fields: [payments.fighterUserId],
		references: [users.id],
		relationName: "payments_fighterUserId_users_id"
	}),
	gymProfile: one(gymProfiles, {
		fields: [payments.gymId],
		references: [gymProfiles.id]
	}),
	user_userId: one(users, {
		fields: [payments.userId],
		references: [users.id],
		relationName: "payments_userId_users_id"
	}),
	paymentEvents: many(paymentEvents),
	paymentTransfers: many(paymentTransfers),
	refunds: many(refunds),
}));

export const gymMembershipRequestsRelations = relations(gymMembershipRequests, ({one}) => ({
	user_fighterUserId: one(users, {
		fields: [gymMembershipRequests.fighterUserId],
		references: [users.id],
		relationName: "gymMembershipRequests_fighterUserId_users_id"
	}),
	gymProfile: one(gymProfiles, {
		fields: [gymMembershipRequests.gymId],
		references: [gymProfiles.id]
	}),
	gymMembership: one(gymMemberships, {
		fields: [gymMembershipRequests.membershipId],
		references: [gymMemberships.id]
	}),
	user_respondedByUserId: one(users, {
		fields: [gymMembershipRequests.respondedByUserId],
		references: [users.id],
		relationName: "gymMembershipRequests_respondedByUserId_users_id"
	}),
}));

export const gymOwnersRelations = relations(gymOwners, ({one}) => ({
	user: one(users, {
		fields: [gymOwners.userId],
		references: [users.id]
	}),
}));

export const gymVerificationRelations = relations(gymVerification, ({one}) => ({
	gymProfile: one(gymProfiles, {
		fields: [gymVerification.gymId],
		references: [gymProfiles.id]
	}),
	user: one(users, {
		fields: [gymVerification.reviewedByUserId],
		references: [users.id]
	}),
}));

export const sparringRequestsRelations = relations(sparringRequests, ({one, many}) => ({
	user_receiverId: one(users, {
		fields: [sparringRequests.receiverId],
		references: [users.id],
		relationName: "sparringRequests_receiverId_users_id"
	}),
	user_senderId: one(users, {
		fields: [sparringRequests.senderId],
		references: [users.id],
		relationName: "sparringRequests_senderId_users_id"
	}),
	messages: many(messages),
}));

export const messagesRelations = relations(messages, ({one}) => ({
	sparringRequest: one(sparringRequests, {
		fields: [messages.matchId],
		references: [sparringRequests.id]
	}),
	user: one(users, {
		fields: [messages.senderId],
		references: [users.id]
	}),
}));

export const notificationsRelations = relations(notifications, ({one}) => ({
	user: one(users, {
		fields: [notifications.userId],
		references: [users.id]
	}),
}));

export const paymentEventsRelations = relations(paymentEvents, ({one}) => ({
	payment: one(payments, {
		fields: [paymentEvents.paymentId],
		references: [payments.id]
	}),
}));

export const paymentTransfersRelations = relations(paymentTransfers, ({one}) => ({
	payment: one(payments, {
		fields: [paymentTransfers.paymentId],
		references: [payments.id]
	}),
}));

export const refundsRelations = relations(refunds, ({one}) => ({
	payment: one(payments, {
		fields: [refunds.paymentId],
		references: [payments.id]
	}),
}));

export const sessionsRelations = relations(sessions, ({one}) => ({
	user: one(users, {
		fields: [sessions.userId],
		references: [users.id]
	}),
}));

export const subscriptionsRelations = relations(subscriptions, ({one}) => ({
	gymProfile: one(gymProfiles, {
		fields: [subscriptions.gymId],
		references: [gymProfiles.id]
	}),
	user: one(users, {
		fields: [subscriptions.userId],
		references: [users.id]
	}),
}));

export const userBlocksRelations = relations(userBlocks, ({one}) => ({
	user_blockedUserId: one(users, {
		fields: [userBlocks.blockedUserId],
		references: [users.id],
		relationName: "userBlocks_blockedUserId_users_id"
	}),
	user_blockerUserId: one(users, {
		fields: [userBlocks.blockerUserId],
		references: [users.id],
		relationName: "userBlocks_blockerUserId_users_id"
	}),
}));

export const userReportsRelations = relations(userReports, ({one}) => ({
	user_reportedUserId: one(users, {
		fields: [userReports.reportedUserId],
		references: [users.id],
		relationName: "userReports_reportedUserId_users_id"
	}),
	user_reporterUserId: one(users, {
		fields: [userReports.reporterUserId],
		references: [users.id],
		relationName: "userReports_reporterUserId_users_id"
	}),
}));

export const userRolesRelations = relations(userRoles, ({one}) => ({
	user: one(users, {
		fields: [userRoles.userId],
		references: [users.id]
	}),
}));