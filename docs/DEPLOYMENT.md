# Deployment guide

Deploy **jabin-crm** to production with Neon (Postgres), Vercel (Next.js), and external webhooks/cron.

## Architecture

| Component | Service |
|-----------|---------|
| App | Vercel (Next.js 16 App Router) |
| Database | [Neon](https://neon.tech) PostgreSQL |
| Rate limiting | Redis (`REDIS_URL`) — Upstash or any Redis compatible with `ioredis` |
| Email | SMTP / SendGrid / Resend |
| Payments | Razorpay (subscriptions + optional company payroll) |
| Errors | Sentry (optional) |

## 1. Neon database

1. Create a Neon project and copy the **pooled** connection string → `DATABASE_URL`
2. Copy the **direct** connection string → `DIRECT_URL` (for Prisma Migrate)
3. Use `?sslmode=require` on hosted URLs

```bash
npx prisma migrate deploy
```

## 2. Vercel project

1. Import the Git repository
2. Set **Root Directory** to repo root
3. Build command: `npm run build` (default)
4. Add all variables from `.env.example` (Production environment)

### Required in production

| Variable | Notes |
|----------|--------|
| `DATABASE_URL` | Neon pooled URL |
| `DIRECT_URL` | Neon direct URL |
| `AUTH_SECRET` | `openssl rand -hex 32` |
| `AUTH_URL` | `https://your-domain.com` |
| `ENCRYPTION_KEY` | 32+ chars |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | OAuth |
| `EMAIL_PROVIDER=smtp` + SMTP_* | Outbound email |
| `RAZORPAY_*` + `RAZORPAY_WEBHOOK_SECRET` | Billing + payroll webhooks |
| `CRON_SECRET` | Min 16 chars; cron routes use `Authorization: Bearer` |
| `REDIS_URL` | Strongly recommended on Vercel (multi-instance rate limits) |
| `INBOUND_EMAIL_WEBHOOK_SECRET` | Email-to-ticket + `/api/emails/reply` |

### Staging-only

| Variable | Notes |
|----------|--------|
| `ALLOW_MANUAL_PAYROLL_MARK_PAID=true` | Mark payslips paid without Razorpay (never in prod) |

Server **fails fast on boot** in production if validation fails (`instrumentation.ts` → `lib/env-validation.ts`).

## 3. Webhook URLs (configure in provider dashboards)

| Endpoint | Purpose | Auth |
|----------|---------|------|
| `https://your-domain.com/api/webhooks/razorpay` | Subscriptions + payroll `payment.captured` → `payslip.isPaid` | `x-razorpay-signature` + `RAZORPAY_WEBHOOK_SECRET` |
| `https://your-domain.com/api/emails/webhook/inbound` | Email → ticket | Optional `INBOUND_EMAIL_WEBHOOK_SECRET` |
| `https://your-domain.com/api/emails/reply` | Provider reply tracking | Same secret as inbound (optional) |
| `https://your-domain.com/api/whatsapp/webhook` | WhatsApp (Twilio/Meta) | Provider-specific |
| `https://your-domain.com/api/emails/track/open/[id]` | Open pixel | Public (no auth) |
| `https://your-domain.com/api/emails/track/click/[id]` | Click redirect | Public (no auth) |

### Razorpay payroll flow

1. Admin clicks **Pay via Razorpay** → `POST /api/payrolls/process` creates order with `notes.payslipId`
2. Payment completes → Razorpay sends `payment.captured` to `/api/webhooks/razorpay`
3. Handler sets `payslip.isPaid = true`, `paidAt = now()`

Enable company payroll Razorpay in company settings JSON: `settings.payroll.razorpay.enabled`.

## 4. Cron jobs (Vercel Cron or external scheduler)

All routes expect:

```http
Authorization: Bearer <CRON_SECRET>
```

| Route | Suggested schedule |
|-------|-------------------|
| `/api/cron/process-queue` | Every 5 min |
| `/api/cron/process-sequences` | Every 15 min |
| `/api/cron/check-replies` | Every 30 min |
| `/api/cron/daily-tasks` | Daily |
| `/api/cron/calculate-scores` | Daily |

Example `vercel.json` cron (add to project if using Vercel Cron):

```json
{
  "crons": [
    { "path": "/api/cron/process-queue", "schedule": "*/5 * * * *" },
    { "path": "/api/cron/process-sequences", "schedule": "*/15 * * * *" }
  ]
}
```

## 5. Redis (rate limiting)

Set `REDIS_URL` to your Redis instance. Without it, rate limits use in-memory storage (single instance only — not suitable for scaled Vercel).

[Upstash Redis](https://upstash.com) works with the standard `rediss://` URL format.

## 6. CI / QA

- **CI**: GitHub Actions runs `lint`, `jest`, `build` on every PR (`.github/workflows/ci.yml`)
- **Staging QA script**:

```bash
STAGING_BASE_URL=https://staging.example.com \
QA_SESSION_COOKIE="next-auth.session-token=..." \
QA_WORKSPACE_SLUG=your-company \
INBOUND_EMAIL_WEBHOOK_SECRET=... \
npm run qa:staging
```

Run the printed **manual checklist once per plan tier** (free, starter, professional, enterprise).

## 7. Post-deploy smoke test

```bash
curl -s https://your-domain.com/api/health | jq .
npx playwright test --config=playwright.config.ts
# with PLAYWRIGHT_BASE_URL=https://your-domain.com
```

## 8. Security checklist

- [ ] `INBOUND_EMAIL_WEBHOOK_SECRET` set in production
- [ ] `REDIS_URL` set for multi-instance rate limiting
- [ ] `ALLOW_MANUAL_PAYROLL_MARK_PAID` **not** set in production
- [ ] Razorpay webhook secret matches dashboard
- [ ] Cron routes not callable without `CRON_SECRET`
- [ ] Super-admin accounts limited and MFA where possible
