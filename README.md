# Jabin CRM — CRM + HRMS + Customer Support

Multi-tenant SaaS platform: **sales CRM**, **company HRMS** (attendance, leave, payroll), and **customer support** (tickets, live chat, KB, portal). Subscription plans control billable CRM/support modules; HRMS is included for every company workspace.

## Features

### CRM & revenue
Leads, deals, quotations, invoices, customers, email campaigns/sequences, WhatsApp, usage quotas by plan.

### HRMS (company-internal, not plan-gated)
Employee attendance, leave requests, payslips; admin payroll generation, leave approval, employee management under `/[company]/dashboard`.

### Customer support
Tickets, SLA, omnichannel inbox, live chat, knowledge base, canned responses, customer portal, inbound email → ticket.

## Tech stack

- **Next.js 16** (App Router), **TypeScript**, **Tailwind**, **shadcn/ui**
- **PostgreSQL** + **Prisma**
- **NextAuth v5** (Google + credentials)
- **Razorpay** subscriptions + payroll orders
- **Redis** (optional) for distributed rate limiting
- **Playwright** + **Jest** for tests

## Quick start

```bash
git clone <repo>
cd jabin-crm
npm install
cp .env.example .env   # fill in values
npx prisma migrate dev
npm run dev
```

Open `http://localhost:3000`.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm test` | Jest unit tests |
| `npm run test:e2e` | Playwright API/smoke tests |
| `npm run qa:staging` | Staging QA automation + manual checklist |

## Production deployment

See **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** for Neon, Vercel, webhooks, cron, and Redis setup.

Environment variables are validated on server boot in production (`lib/env-validation.ts`).

## Testing

**Unit tests** (`lib/__tests__/`): env validation, email webhook auth, rate limits, encryption.

**E2E smoke** (`tests/e2e/`): health endpoint, auth pages, API 401 guards.

```bash
PLAYWRIGHT_BASE_URL=http://localhost:3000 npm run test:e2e
```

**Staging QA** (full flow checklist per plan tier):

```bash
STAGING_BASE_URL=https://staging.example.com npm run qa:staging
```

## Project structure

```
app/
  dashboard/          # Agent CRM + support (subscription-gated modules)
  [company]/        # Company workspace (HRMS + tenant CRM)
  [company]/employee/
  portal/             # Customer portal
  api/                # REST API routes
lib/
  feature-modules.ts  # Plan module resolution
  env-validation.ts   # Boot-time env checks
docs/
  DEPLOYMENT.md       # Production guide
```

## License

Private — all rights reserved.
