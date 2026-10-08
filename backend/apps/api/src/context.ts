import type { Db } from "./db/client.js";
import { loadEnv, type Env } from "./env.js";
import { createAuthGuards, type AuthGuards } from "./plugins/auth.plugin.js";
import { AuthService } from "./modules/auth/auth.service.js";
import { createOtpSender } from "./modules/auth/otp.senders.js";
import { FighterService } from "./modules/fighters/fighters.service.js";
import { GymService } from "./modules/gyms/gyms.service.js";
import { MembershipService } from "./modules/gyms/membership.service.js";
import { GymOwnerService } from "./modules/gyms/gym-owner.service.js";
import { SparringService } from "./modules/sparring/sparring.service.js";
import { MessagesService } from "./modules/messages/messages.service.js";
import { ChatHub } from "./modules/messages/realtime.js";
import { NotificationService } from "./modules/notifications/notifications.service.js";
import { AuditService } from "./modules/audit/audit.service.js";
import { AnalyticsService, createAnalyticsSink } from "./modules/analytics/analytics.service.js";
import { EntitlementsService } from "./modules/entitlements/entitlements.service.js";
import { createStorageProvider, type StorageProvider } from "./modules/storage/storage.provider.js";
import { createPaymentProvider } from "./modules/payments/provider.factory.js";
import type { PaymentProvider } from "./modules/payments/payment.types.js";
import { OrdersService } from "./modules/payments/orders.service.js";
import { PaymentService } from "./modules/payments/payment.service.js";
import { RouteService } from "./modules/payments/route.service.js";
import { SubscriptionsService } from "./modules/payments/subscriptions.service.js";
import { WebhooksService } from "./modules/payments/webhooks.service.js";
import { AdminService } from "./modules/admin/admin.service.js";

export interface AppContext {
  env: Env;
  db: Db;
  provider: PaymentProvider;
  storage: StorageProvider;
  guards: AuthGuards;
  audit: AuditService;
  analytics: AnalyticsService;
  notifications: NotificationService;
  entitlements: EntitlementsService;
  auth: AuthService;
  fighters: FighterService;
  gyms: GymService;
  memberships: MembershipService;
  sparring: SparringService;
  messages: MessagesService;
  chatHub: ChatHub;
  orders: OrdersService;
  payments: PaymentService;
  route: RouteService;
  subscriptions: SubscriptionsService;
  webhooks: WebhooksService;
  gymOwner: GymOwnerService;
  admin: AdminService;
}

export interface CreateContextOptions {
  db: Db;
  env?: Env;
  provider?: PaymentProvider;
  storage?: StorageProvider;
}

export async function createContext(options: CreateContextOptions): Promise<AppContext> {
  const env = options.env ?? loadEnv();
  const db = options.db;
  const provider = options.provider ?? createPaymentProvider();
  const storage = options.storage ?? (await createStorageProvider());

  const audit = new AuditService(db);
  const analytics = new AnalyticsService(db, createAnalyticsSink());
  const notifications = new NotificationService(db);
  const entitlements = new EntitlementsService(db);
  const auth = new AuthService(db, createOtpSender());
  const fighters = new FighterService(db);
  const gyms = new GymService(db);
  const memberships = new MembershipService(db, notifications, audit);
  const sparring = new SparringService(db, notifications, audit, entitlements, fighters);
  const messages = new MessagesService(db, sparring, notifications);
  const chatHub = new ChatHub(messages, sparring);
  const orders = new OrdersService(db, provider, memberships);
  const route = new RouteService(db, provider, notifications, audit);
  const subscriptions = new SubscriptionsService(db, provider, notifications, audit);
  const payments = new PaymentService({ db, provider, memberships, notifications, audit, route });
  const webhooks = new WebhooksService({ db, provider, payments, subscriptions, route, audit });
  const gymOwner = new GymOwnerService(
    db,
    gyms,
    memberships,
    orders,
    subscriptions,
    provider,
    audit,
    notifications,
  );
  const admin = new AdminService(db, gyms, audit, notifications, memberships, subscriptions);
  const guards = createAuthGuards({ db, sessions: auth.sessions });

  return {
    env,
    db,
    provider,
    storage,
    guards,
    audit,
    analytics,
    notifications,
    entitlements,
    auth,
    fighters,
    gyms,
    memberships,
    sparring,
    messages,
    chatHub,
    orders,
    payments,
    route,
    subscriptions,
    webhooks,
    gymOwner,
    admin,
  };
}
