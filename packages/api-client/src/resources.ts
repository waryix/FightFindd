import type {
  ApiUserMe,
  CheckoutOrderResponse,
  CreateGymInput,
  CreateSparringRequestInput,
  CreateFighterProfileInput,
  DiscoveryQuery,
  FighterCard,
  FighterMembershipView,
  FighterProfile,
  GymCard,
  GymDashboard,
  GymDetail,
  GymDiscoveryQuery,
  GymMembershipSummary,
  GymMembershipWithFighter,
  GymOwnerOnboardingState,
  AuthSessionResponse,
  RequestOtpInput,
  VerifyOtpInput,
  SparringRequest,
  SparringRequestStatus,
  ChatMessage,
  AppNotification,
  NotificationListQuery,
  PaymentRecord,
  RegisterDeviceInput,
  SubscriptionRecord,
  UpdateFighterProfileInput,
  UpdateGymInput,
  VerifyPaymentInput,
  VerifyPaymentResponse,
  CursorPage,
  Entitlements,
  AdminListQuery,
  AdminVerifyGymInput,
  AnalyticsBatchInput,
  ReportUserInput,
  BlockUserInput,
  AdminUserRecord,
} from "@fightfind/types";
import type { ApiClient, FileUpload } from "./client.js";

export function createAuthApi(client: ApiClient) {
  return {
    requestOtp: (input: RequestOtpInput) =>
      client.post<{ challengeId: string; channel: string; identifier: string; expiresAt: string; devOtp?: string }>(
        "/api/v1/auth/otp/request",
        input,
        { auth: false },
      ),
    verifyOtp: (input: VerifyOtpInput) =>
      client.post<AuthSessionResponse>("/api/v1/auth/otp/verify", input, { auth: false }),
    guest: () => client.post<AuthSessionResponse>("/api/v1/auth/guest", {}, { auth: false }),
    refresh: (refreshToken?: string) =>
      client.post<AuthSessionResponse>("/api/v1/auth/refresh", { refreshToken }, { auth: false }),
    logout: (refreshToken?: string) =>
      client.post<{ success: boolean }>("/api/v1/auth/logout", { refreshToken }),
  };
}

export function createUsersApi(client: ApiClient) {
  return {
    me: () => client.get<ApiUserMe>("/api/v1/users/me"),
    updateMe: (input: { name?: string }) => client.patch<ApiUserMe>("/api/v1/users/me", input),
  };
}

export function createFightersApi(client: ApiClient) {
  return {
    discover: (query: Partial<DiscoveryQuery>) =>
      client.get<CursorPage<FighterCard>>("/api/v1/fighters", { query: query as Record<string, string | number | undefined> }),
    get: (id: string, coords?: { lat?: number; lng?: number }) =>
      client.get<{ fighter: FighterCard }>(`/api/v1/fighters/${id}`, { query: coords }),
    me: () => client.get<{ fighter: FighterProfile | null }>("/api/v1/fighters/me"),
    createProfile: (input: CreateFighterProfileInput) =>
      client.post<{ fighter: FighterProfile }>("/api/v1/fighters/me", input),
    updateProfile: (input: UpdateFighterProfileInput) =>
      client.patch<{ fighter: FighterProfile }>("/api/v1/fighters/me", input),
    uploadAvatar: (file: FileUpload) => client.upload<{ avatarUrl: string }>("/api/v1/fighters/me/avatar", file),
    memberships: () => client.get<CursorPage<FighterMembershipView>>("/api/v1/fighters/me/memberships"),
    block: (input: BlockUserInput) => client.post<{ success: boolean }>("/api/v1/fighters/me/blocks", input),
    unblock: (userId: string) => client.delete<{ success: boolean }>(`/api/v1/fighters/me/blocks/${userId}`),
    report: (input: ReportUserInput) => client.post<{ success: boolean }>("/api/v1/fighters/me/reports", input),
  };
}

export function createGymsApi(client: ApiClient) {
  return {
    discover: (query: Partial<GymDiscoveryQuery>) =>
      client.get<CursorPage<GymCard>>("/api/v1/gyms", { query: query as Record<string, string | number | undefined> }),
    get: (id: string, coords?: { lat?: number; lng?: number }) =>
      client.get<{ gym: GymDetail }>(`/api/v1/gyms/${id}`, { query: coords }),
    myMembership: (gymId: string) =>
      client.get<{ membership: GymMembershipSummary | null }>(`/api/v1/gyms/${gymId}/membership`, { auth: true }),
    membershipOrder: (gymId: string) =>
      client.post<CheckoutOrderResponse>(`/api/v1/gyms/${gymId}/membership/order`, {}, { auth: true }),
  };
}

export function createMatchesApi(client: ApiClient) {
  return {
    list: (query: { tab: "received" | "sent"; status?: SparringRequestStatus; cursor?: string; limit?: number }) =>
      client.get<CursorPage<SparringRequest>>("/api/v1/matches", { query: query as Record<string, string | number | undefined> }),
    get: (id: string) => client.get<{ match: SparringRequest }>(`/api/v1/matches/${id}`),
    create: (input: CreateSparringRequestInput) => client.post<{ match: SparringRequest }>("/api/v1/sparring", input),
    updateStatus: (id: string, status: SparringRequestStatus) =>
      client.patch<{ match: SparringRequest }>(`/api/v1/matches/${id}/status`, { status }),
  };
}

export function createMessagesApi(client: ApiClient) {
  return {
    history: (matchId: string, query?: { cursor?: string; limit?: number }) =>
      client.get<CursorPage<ChatMessage>>(`/api/v1/messages/${matchId}`, { query: query as Record<string, string | number | undefined> }),
    send: (matchId: string, content: string) => client.post<{ message: ChatMessage }>(`/api/v1/messages/${matchId}`, { content }),
    markRead: (matchId: string) => client.post<{ success: boolean }>(`/api/v1/messages/${matchId}/read`, {}),
  };
}

export function createPaymentsApi(client: ApiClient) {
  return {
    createOrder: (product: "GYM_MEMBERSHIP" | "GYM_LISTING" | string, gymId?: string) =>
      client.post<CheckoutOrderResponse>("/api/v1/payments/order", { product, gymId }, { auth: true }),
    verify: (input: VerifyPaymentInput) => client.post<VerifyPaymentResponse>("/api/v1/payments/verify", input, { auth: true }),
    get: (id: string) => client.get<{ payment: PaymentRecord }>(`/api/v1/payments/${id}`),
  };
}

export function createSubscriptionsApi(client: ApiClient) {
  return {
    createFighterUpgrade: () =>
      client.post<{ subscription: SubscriptionRecord; razorpayKeyId: string; testMode: boolean }>(
        "/api/v1/subscriptions/fighter-upgrade",
        {},
        { auth: true },
      ),
    createGymPlatform: (gymId: string) =>
      client.post<{ subscription: SubscriptionRecord; razorpayKeyId: string; testMode: boolean }>(
        "/api/v1/subscriptions/gym-platform",
        { gymId },
        { auth: true },
      ),
    get: (id: string) => client.get<{ subscription: SubscriptionRecord }>(`/api/v1/subscriptions/${id}`),
    mySubscription: () =>
      client.get<{ subscription: SubscriptionRecord | null }>("/api/v1/subscriptions/me"),
    verify: (id: string, input: { razorpayPaymentId: string; razorpaySubscriptionId: string; razorpaySignature: string }) =>
      client.post<{ verified: boolean; subscription: SubscriptionRecord }>(
        `/api/v1/subscriptions/${id}/verify`,
        input,
      ),
    sync: (id: string) =>
      client.post<{ subscription: SubscriptionRecord }>(`/api/v1/subscriptions/${id}/sync`, {}),
    cancel: (id: string, cancelAtPeriodEnd = true) =>
      client.post<{ subscription: SubscriptionRecord }>(`/api/v1/subscriptions/${id}/cancel`, { cancelAtPeriodEnd }),
    myEntitlements: () => client.get<{ entitlements: Entitlements }>("/api/v1/subscriptions/me/entitlements"),
  };
}

export function createGymOwnerApi(client: ApiClient) {
  const base = "/api/v1/gym-owner";
  return {
    onboarding: () => client.get<{ onboarding: GymOwnerOnboardingState }>(`${base}/onboarding`),
    createGym: (input: CreateGymInput) => client.post<{ gym: GymDetail }>(`${base}/gyms`, input),
    listGyms: () => client.get<{ gyms: GymDetail[] }>(`${base}/gyms`),
    getGym: (id: string) => client.get<{ gym: GymDetail }>(`${base}/gyms/${id}`),
    updateGym: (id: string, input: UpdateGymInput) => client.patch<{ gym: GymDetail }>(`${base}/gyms/${id}`, input),
    dashboard: (gymId: string) => client.get<{ dashboard: GymDashboard }>(`${base}/gyms/${gymId}/dashboard`),
    requests: (gymId: string, query?: { status?: string; cursor?: string; limit?: number }) =>
      client.get<CursorPage<GymMembershipWithFighter>>(`${base}/gyms/${gymId}/requests`, { query: query as Record<string, string | number | undefined> }),
    members: (gymId: string, query?: { status?: string; cursor?: string; limit?: number }) =>
      client.get<CursorPage<GymMembershipWithFighter>>(`${base}/gyms/${gymId}/members`, { query: query as Record<string, string | number | undefined> }),
    payments: (gymId: string, query?: { cursor?: string; limit?: number }) =>
      client.get<CursorPage<PaymentRecord>>(`${base}/gyms/${gymId}/payments`, { query: query as Record<string, string | number | undefined> }),
    acceptMembership: (id: string) => client.post<{ membership: GymMembershipSummary }>(`${base}/memberships/${id}/accept`, {}),
    declineMembership: (id: string) => client.post<{ membership: GymMembershipSummary }>(`${base}/memberships/${id}/decline`, {}),
    startRazorpayOnboarding: (gymId: string) =>
      client.post<{ linkedAccountId: string; onboardingStatus: string; onboardingUrl?: string }>(
        `${base}/gyms/${gymId}/razorpay-account`,
        {},
      ),
    refreshRazorpayStatus: (gymId: string) =>
      client.get<{ linkedAccountId: string | null; onboardingStatus: string }>(`${base}/gyms/${gymId}/razorpay-account`),
    payListingFee: (gymId: string) =>
      client.post<CheckoutOrderResponse>(`${base}/gyms/${gymId}/listing-fee/order`, {}),
    uploadGymPhoto: (gymId: string, file: FileUpload) =>
      client.upload<{ photoUrl: string }>(`${base}/gyms/${gymId}/photos`, file),
    notifications: () => client.get<CursorPage<AppNotification>>(`${base}/notifications`),
  };
}

export function createNotificationsApi(client: ApiClient) {
  return {
    list: (query?: NotificationListQuery) =>
      client.get<CursorPage<AppNotification>>("/api/v1/notifications", { query: query as Record<string, string | number | boolean | undefined> }),
    markRead: (input: { ids?: string[]; all?: boolean }) =>
      client.post<{ success: boolean; updated: number }>("/api/v1/notifications/read", input),
    registerDevice: (input: RegisterDeviceInput) =>
      client.post<{ success: boolean }>("/api/v1/notifications/devices", input),
    removeDevice: (token: string) =>
      client.delete<{ success: boolean }>("/api/v1/notifications/devices", { body: { token } }),
  };
}

export function createAdminApi(client: ApiClient) {
  const base = "/api/v1/admin";
  return {
    listGyms: (query?: AdminListQuery) =>
      client.get<CursorPage<GymDetail>>(`${base}/gyms`, { query: query as Record<string, string | number | undefined> }),
    verifyGym: (id: string, input: AdminVerifyGymInput) =>
      client.post<{ gym: GymDetail }>(`${base}/gyms/${id}/verification`, input),
    listUsers: (query?: AdminListQuery) =>
      client.get<CursorPage<AdminUserRecord>>(`${base}/users`, { query: query as Record<string, string | number | undefined> }),
    listPayments: (query?: AdminListQuery) =>
      client.get<CursorPage<PaymentRecord>>(`${base}/payments`, { query: query as Record<string, string | number | undefined> }),
    listFailedPayments: (query?: AdminListQuery) =>
      client.get<CursorPage<PaymentRecord>>(`${base}/payments/failed`, { query: query as Record<string, string | number | undefined> }),
    listMemberships: (query?: AdminListQuery) =>
      client.get<CursorPage<GymMembershipSummary>>(`${base}/memberships`, { query: query as Record<string, string | number | undefined> }),
    listAuditLogs: (query?: AdminListQuery) =>
      client.get<CursorPage<unknown>>(`${base}/audit-logs`, { query: query as Record<string, string | number | undefined> }),
  };
}

export function createConfigApi(client: ApiClient) {
  return {
    publicConfig: () =>
      client.get<{
        currency: string;
        paymentMode: "test" | "live" | "mock";
        razorpayKeyId: string | null;
        pricing: {
          fighterPremiumMonthlyPaise: number;
          gymListingFeePaise: number;
          gymPlatformMonthlyPaise: number;
        };
      }>("/api/v1/config", { auth: false }),
  };
}

export function createAnalyticsApi(client: ApiClient) {
  return {
    track: (input: AnalyticsBatchInput) => client.post<{ success: boolean }>("/api/v1/analytics/events", input),
  };
}

export interface Api {
  auth: ReturnType<typeof createAuthApi>;
  users: ReturnType<typeof createUsersApi>;
  fighters: ReturnType<typeof createFightersApi>;
  gyms: ReturnType<typeof createGymsApi>;
  matches: ReturnType<typeof createMatchesApi>;
  messages: ReturnType<typeof createMessagesApi>;
  payments: ReturnType<typeof createPaymentsApi>;
  subscriptions: ReturnType<typeof createSubscriptionsApi>;
  gymOwner: ReturnType<typeof createGymOwnerApi>;
  notifications: ReturnType<typeof createNotificationsApi>;
  admin: ReturnType<typeof createAdminApi>;
  config: ReturnType<typeof createConfigApi>;
  analytics: ReturnType<typeof createAnalyticsApi>;
  raw: ApiClient;
}

export function createApi(client: ApiClient): Api {
  return {
    auth: createAuthApi(client),
    users: createUsersApi(client),
    fighters: createFightersApi(client),
    gyms: createGymsApi(client),
    matches: createMatchesApi(client),
    messages: createMessagesApi(client),
    payments: createPaymentsApi(client),
    subscriptions: createSubscriptionsApi(client),
    gymOwner: createGymOwnerApi(client),
    notifications: createNotificationsApi(client),
    admin: createAdminApi(client),
    config: createConfigApi(client),
    analytics: createAnalyticsApi(client),
    raw: client,
  };
}
