# Deployment runbook

Production topology:

```
Fighter app (Vercel, Expo web)   Gym portal (Vercel, Next.js)
  app.fightfind.in                 gym.fightfind.in
              \                        /
               \                      /
                FightFind API (Render, Docker)
                     api.fightfind.in
                          |
                  Supabase PostgreSQL
                  (Session pooler + TLS)
                          |
              S3-compatible object storage (uploads)
```

| Piece                                   | Platform        | Domain             |
| --------------------------------------- | --------------- | ------------------ |
| API (`backend/apps/api`)                | Render (Docker) | `api.fightfind.in` |
| Gym portal (`frontend/apps/gym-portal`) | Vercel          | `gym.fightfind.in` |
| Mobile web (`frontend/apps/mobile`)     | Vercel          | `app.fightfind.in` |
| Database                                | Supabase        | —                  |
| Uploads                                 | S3-compatible   | —                  |

Keeping all three on subdomains of one parent (`fightfind.in`) makes the refresh
cookie **same-site**, so the API's `SameSite=Lax` cookie works across
`api` ↔ `gym` without any code change. If you instead use the default
`*.onrender.com` / `*.vercel.app` domains, the portal's refresh cookie is
cross-site and will not be sent.

---

## 1. Supabase (database)

1. Create a project in a region near your API (e.g. **Sydney** to match Render
   `singapore`, or Mumbai for S3 `ap-south-1`).
2. **Settings → API → disable the Data API** (and "Expose public schema"). The
   app only talks through the Fastify API, so PostgREST must not expose
   `public`.
3. Copy the **Session pooler** connection string (Project Settings → Database):
   ```
   postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
   ```
   Append `?sslmode=require`. For strict TLS use
   `?sslmode=verify-full&sslrootcert=/path/to/prod-ca-2021.crt` and mount
   Supabase's CA certificate next to the API. If you hit
   `SELF_SIGNED_CERT_IN_CHAIN`, use `?sslmode=no-verify` (see Troubleshooting).
4. Apply migrations from your machine (the API also migrates on boot):
   ```bash
   # backend/apps/api/.env -> DATABASE_URL=<supabase session pooler url>
   pnpm db:migrate
   ```
5. Do **not** run `pnpm db:seed`, `pnpm db:reset` or `pnpm db:studio` against
   production. Integration tests keep using the local Docker database via
   `DATABASE_URL_TEST`.

The schema needs no extensions (only core `gen_random_uuid()` and core math for
geo search), so no Supabase extensions must be enabled.

---

## 2. Render (API)

### Option A — Blueprint (recommended)

`render.yaml` at the repo root defines the service. In Render:
**New → Blueprint → connect the repo**, then fill in every prompted value.

### Option B — manual web service

- **Runtime:** Docker
- **Dockerfile path:** `./Dockerfile`, **context:** repository root
- **Health check path:** `/health`
- **Region:** Singapore
- **Do not set `PORT`** — Render injects it; the app binds `HOST=0.0.0.0`.
- The image runs migrations then starts the server.

### Environment variables

| Key                                                                                                            | Value                                               |
| -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `NODE_ENV`                                                                                                     | `production`                                        |
| `DATABASE_URL`                                                                                                 | Supabase Session pooler + `?sslmode=require`        |
| `DATABASE_POOL_MAX`                                                                                            | `5`                                                 |
| `JWT_SECRET`                                                                                                   | long random (Render "Generate")                     |
| `SESSION_SECRET`                                                                                               | long random (Render "Generate")                     |
| `API_PUBLIC_URL`                                                                                               | `https://api.fightfind.in`                          |
| `CORS_ORIGINS`                                                                                                 | `https://gym.fightfind.in,https://app.fightfind.in` |
| `MSG91_AUTH_KEY` / `MSG91_SENDER_ID` / `MSG91_TEMPLATE_ID`                                                     | SMS OTP                                             |
| `RESEND_API_KEY` / `EMAIL_FROM`                                                                                | email OTP                                           |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` / `RAZORPAY_WEBHOOK_SECRET`                                          | live keys                                           |
| `RAZORPAY_FIGHTER_PLAN_ID` / `RAZORPAY_GYM_PLAN_ID` / `RAZORPAY_ACCOUNT_NUMBER`                                | live plan ids + Route account                       |
| `PAYMENT_MODE`                                                                                                 | `live`                                              |
| `PAYMENT_SIMULATOR_ENABLED`                                                                                    | `false`                                             |
| `SUBSCRIPTIONS_FALLBACK_TO_ORDERS`                                                                             | `false`                                             |
| `SKIP_ROUTE_TRANSFERS`                                                                                         | `false`                                             |
| `STORAGE_DRIVER`                                                                                               | `s3`                                                |
| `S3_BUCKET` / `S3_REGION` / `S3_ENDPOINT` / `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` / `S3_PUBLIC_BASE_URL` | object storage                                      |
| `ANALYTICS_SINK`                                                                                               | `posthog` (+ `POSTHOG_API_KEY`) or `none`           |
| `EXPO_ACCESS_TOKEN`                                                                                            | optional (push notifications)                       |

> `DEV_OTP` is ignored when `NODE_ENV=production`, so real OTP providers are
> required for sign-in.

### Custom domain

Add `api.fightfind.in` to the Render service and create a CNAME at your
registrar pointing to the target Render shows (e.g.
`<service>.onrender.com`). Render issues the TLS certificate.

Set `API_PUBLIC_URL` and `CORS_ORIGINS` after the domain is live, then redeploy.

---

## 3. Vercel (frontends)

Create **two** Vercel projects from the same repo.

### Gym portal (`gym.fightfind.in`)

- **Root Directory:** `frontend/apps/gym-portal`
- **Framework:** Next.js (auto-detected)
- Enable **Include source files outside of the Root Directory in the Build Step**
  (the app depends on `frontend/packages/*` and root `packages/*`).
- **Environment variable:** `NEXT_PUBLIC_API_URL=https://api.fightfind.in`
- Add domain `gym.fightfind.in`; CNAME `gym` → `cname.vercel-dns.com`.

### Mobile web (`app.fightfind.in`)

- **Root Directory:** `frontend/apps/mobile`
- **Framework:** Other — `frontend/apps/mobile/vercel.json` sets
  `buildCommand: expo export -p web`, `outputDirectory: dist`, and a catch-all
  rewrite so dynamic routes (`/gym/:id`, `/chat/:matchId`, …) work on refresh.
- Enable **Include source files outside of the Root Directory** as above.
- **Environment variable:** `EXPO_PUBLIC_API_URL=https://api.fightfind.in`
- Add domain `app.fightfind.in`; CNAME `app` → `cname.vercel-dns.com`.

Both `NEXT_PUBLIC_API_URL` and `EXPO_PUBLIC_API_URL` are baked at build time —
redeploy after changing them.

---

## 4. Razorpay

- Webhook URL: `POST https://api.fightfind.in/api/v1/webhooks/razorpay`
- Subscribe to the official events listed in the root `README.md`
  (`payment.*`, `order.paid`, `refund.*`, `subscription.*`, `invoice.paid`,
  `transfer.*`, `product.route.*`).
- Set `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` and
  `PAYMENT_MODE=live` on Render.

---

## 5. Verify

1. Render logs show the migration output followed by
   `FightFind API listening on https://api.fightfind.in (production)`.
2. `curl https://api.fightfind.in/health` → `200`; `/docs` → `200`.
3. Sign up / log in with a real phone or email on both the gym portal and the
   mobile web app (OTP via MSG91/Resend).
4. Make a small live Razorpay payment and confirm the webhook is delivered and
   the membership/subscription state updates.
5. Refresh the gym portal page and confirm the session survives (same-site
   refresh cookie).

---

## Troubleshooting

| Symptom                          | Likely cause                                                                                                                                  |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Portal logs out on refresh       | API and portal on different sites — use the `fightfind.in` subdomains                                                                         |
| `password authentication failed` | Wrong `DATABASE_URL` password (URL-encode special characters)                                                                                 |
| `SELF_SIGNED_CERT_IN_CHAIN`      | `sslmode=require` is treated as full verification; use `?sslmode=no-verify`, or supply Supabase's CA with `sslmode=verify-full&sslrootcert=…` |
| `too many connections`           | Lower `DATABASE_POOL_MAX`                                                                                                                     |
| Migrations race on deploy        | Scale to one instance, or move migrations to a release step                                                                                   |
| CORS error in the browser        | Missing origin in `CORS_ORIGINS` (redeploy after changing)                                                                                    |
| Uploads vanish after redeploy    | `STORAGE_DRIVER=local` on Render's ephemeral disk — use S3                                                                                    |
| Mobile web 404 on deep link      | `vercel.json` rewrites missing/overridden in the Vercel project                                                                               |
