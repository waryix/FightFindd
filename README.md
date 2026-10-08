# FightFind 2.0

FightFind connects combat-sports athletes in India with sparring partners and combat-sports gyms.
This is a complete from-scratch rebuild: a fighter mobile app, a gym-owner portal, and a
production-grade API with real payments, subscriptions and marketplace transfers.

```
Fighter app (Expo)        Gym portal (Next.js)          API (Fastify)
     │                          │                          │
     └─────────── @fightfind/api-client ───────────────────┘
                          │
                    PostgreSQL (Drizzle ORM)
                          │
                 Razorpay (orders, subscriptions, Route)
```

## Repository structure

```text
apps/
  api/          Fastify + Drizzle + PostgreSQL backend (REST, WebSockets, webhooks)
  mobile/       Expo + React Native fighter app (Expo Router)
  gym-portal/   Next.js gym owner dashboard
packages/
  types/        Shared Zod schemas, DTOs, enums, pricing defaults
  utils/        Compatibility scoring, geo, money, state machines (unit-tested)
  ui/           React Native design system (cards, chips, buttons, payment states)
  config/       Design tokens + shared tooling config
  api-client/   Typed API client used by both frontends
docs/
  openapi.yaml  OpenAPI 3.1 documentation (also served at /docs)
```

## Prerequisites

- Node.js >= 20 (22 recommended)
- pnpm 11 (`corepack enable`)
- Docker (for local PostgreSQL) — or any PostgreSQL 15+ database
- For mobile builds: Expo Go (SDK 57) or an EAS development build

## Quick start

```bash
pnpm install
cp apps/api/.env.example apps/api/.env         # defaults work for local dev
pnpm db:up                                     # starts PostgreSQL 18 in Docker
pnpm db:migrate
pnpm db:seed                                   # demo fighters, gyms, memberships

pnpm dev:api                                   # http://localhost:4001  (docs at /docs)
pnpm dev:gym-portal                            # http://localhost:3001
pnpm dev:mobile                                # Expo dev server
```

`pnpm dev` (Turborepo) runs all three together.

### Demo accounts (OTP `123456` in development)

| Role       | Identifier                          |
| ---------- | ----------------------------------- |
| Fighter    | `+919900000001` (Arjun Singh)       |
| Gym owner  | `+919900000010` (Iron Fist MMA)     |
| Admin      | `+919900000099`                     |

## Environment variables

Each app ships a `.env.example`:

- `apps/api/.env.example` — database, JWT/session secrets, OTP providers (MSG91/Resend),
  Razorpay keys and plan ids, pricing in paise, storage, analytics.
- `apps/mobile/.env.example` — `EXPO_PUBLIC_API_URL` (use your LAN IP on a physical device).
- `apps/gym-portal/.env.example` — `NEXT_PUBLIC_API_URL`.

Rules enforced by the API:

- `RAZORPAY_KEY_SECRET` / `RAZORPAY_WEBHOOK_SECRET` never leave the server.
- `DEV_OTP` is only accepted when `NODE_ENV != production` and is never logged in production.
- `PAYMENT_MODE=mock` is rejected in production unless the simulator flag is explicitly set.
- Prices live in configuration (`FIGHTER_PREMIUM_MONTHLY_PAISE=19900`,
  `GYM_LISTING_FEE_PAISE=99900`, `GYM_PLATFORM_MONTHLY_PAISE=39900`), never in components.

## Database

PostgreSQL is required in every environment (no SQLite). Drizzle manages the schema.

```bash
pnpm db:up          # docker compose up -d postgres
pnpm db:migrate     # apply drizzle/*.sql migrations
pnpm db:seed        # development seed data
pnpm db:reset       # drop + recreate (dev/test only)
pnpm db:studio      # browse data
```

Distance filtering, sorting and pagination all run inside PostgreSQL (haversine expressions
plus bounding-box index prefiltering). Fighters and gyms are never loaded wholesale into Node.

## Running the mobile app

```bash
pnpm dev:mobile                 # then press a (Android) / i (iOS) / w (web)
```

- Expo Router powers navigation; the information architecture matches the original FightFind
  (Discover, Gyms, Matches, Profile) with chat nested under matches.
- Auth tokens are stored with `expo-secure-store` (never plain AsyncStorage).
- Location is only requested when you enable "near me" in Discover/Gyms, never on launch.
- Payments open a Razorpay Checkout WebView; the server verifies signatures and webhooks.
- In local dev with `PAYMENT_MODE=mock`, checkout offers an explicit simulator button.

Builds: `eas build --profile preview -p android` (see `apps/mobile/eas.json`).

## Running the gym portal

```bash
pnpm dev:gym-portal             # http://localhost:3001
```

- Gym owners sign up/log in with phone or email OTP. A fighter account without a gym-owner
  relationship receives “This account does not have gym-owner access.” — enforced by the API.
- Onboarding walks: gym details → business details → Razorpay linked account → listing fee →
  monthly platform plan → verification → live.
- The session uses an httpOnly refresh cookie plus an in-memory access token.

## Razorpay setup

1. Create a Razorpay account in **Test mode** and generate API keys.
2. Create two Plans (monthly, INR) for:
   - FightFind Pro — `RAZORPAY_FIGHTER_PLAN_ID`
   - Gym platform plan — `RAZORPAY_GYM_PLAN_ID`
3. Enable **Route** and create linked accounts for gyms (the portal does this through the API;
   bank details stay inside Razorpay).
4. Set `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`.
5. Webhook endpoint: `POST {API_PUBLIC_URL}/api/v1/webhooks/razorpay`.
   Subscribe to (official event names):
   - `payment.captured`, `payment.authorized`, `payment.failed`, `order.paid`
   - `refund.created`, `refund.processed`, `refund.failed`
   - `subscription.authenticated|activated|charged|pending|halted|cancelled|completed|paused|resumed|updated`
   - `invoice.paid`
   - `transfer.processed`, `transfer.failed`, `transfer.reversed`
   - `product.route.under_review`, `product.route.needs_clarification`

For local webhook testing, expose the API (e.g. `ngrok http 4000`) and point Razorpay at the
tunnel. Webhooks verify the `X-Razorpay-Signature` HMAC over the raw body, deduplicate on
`X-Razorpay-event-id`, and every handler is idempotent.

### Money model

| Flow | Customer | Merchant | Provider |
| --- | --- | --- | --- |
| Gym membership | Fighter | Gym (Razorpay Route linked account) | order + transfer |
| Gym listing fee | Gym owner | FightFind | one-time order |
| Gym platform plan | Gym owner | FightFind | subscription |
| FightFind Pro | Fighter | FightFind | subscription |

Membership payments are transferred to the gym with `PLATFORM_COMMISSION_PERCENT`
(default `0` = gym receives 100%). Payment state (captured) and membership state
(`paid_pending_approval → active`) are separate; the transfer never depends on the owner
clicking Accept.

## Testing

```bash
pnpm test                      # everything via Turborepo
pnpm --filter @fightfind/utils test             # scoring, geo, money, state machines
pnpm --filter @fightfind/api test:unit          # OTP/token/signature units
pnpm db:up && pnpm --filter @fightfind/api test:integration
```

Integration tests run against `fightfind_test` (created automatically by docker compose) and
cover signup/OTP, sessions, discovery, sparring, chat permissions, gym onboarding, listing
payments, membership approval, subscriptions, admin verification, webhook duplicates,
out-of-order events, invalid signatures, wrong amounts, refunds and authorization boundaries.

## Deployment

- **API**: any Docker host (Railway/Render/Fly/VPS). `Dockerfile` builds the monorepo and runs
  migrations on boot; `railway.json` is included. Set all secrets from `.env.example`.
- **Gym portal**: Vercel. Set `NEXT_PUBLIC_API_URL` to the API URL.
- **Mobile**: EAS (`eas build`, `eas submit`). Set `EXPO_PUBLIC_API_URL` per profile.
- **Database**: managed PostgreSQL 15+ with connection pooling.

## Security notes

- Roles are always derived server-side from `user_roles`; clients cannot assert roles.
- OTPs are hashed at rest, rate-limited per identifier and expiring; brute force is capped.
- All financial inputs are validated server-side; amounts are integer paise.
- Webhooks and payment callbacks are signature-verified; financial records are append-only.
- Every important state change (payments, verification, memberships, subscriptions) is written
  to `audit_logs`.
