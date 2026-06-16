#!/usr/bin/env node
/**
 * Staging QA runner — automated checks + manual checklist per plan tier.
 *
 * Usage:
 *   STAGING_BASE_URL=https://staging.example.com \
 *   QA_SESSION_COOKIE="next-auth.session-token=..." \
 *   INBOUND_EMAIL_WEBHOOK_SECRET=... \
 *   node scripts/staging-qa.mjs
 *
 * Optional: QA_WORKSPACE_SLUG=acme-corp for company-scoped API calls
 */

const base = (process.env.STAGING_BASE_URL || process.env.PLAYWRIGHT_BASE_URL || '').replace(/\/$/, '');
const cookie = process.env.QA_SESSION_COOKIE || '';
const workspace = process.env.QA_WORKSPACE_SLUG || '';
const webhookSecret = process.env.INBOUND_EMAIL_WEBHOOK_SECRET || '';

const PLAN_TIERS = ['free', 'starter', 'professional', 'enterprise'];

const manualFlow = [
  '1. Sign in as billing admin on plan tier',
  '2. Create lead → deal → quotation → send email (or draft campaign)',
  '3. Create support ticket; verify portal ticket list',
  '4. Start live chat embed with ?companyId=; send visitor message',
  '5. Employee: submit leave request',
  '6. Admin: approve leave at /{slug}/dashboard/leave-requests',
  '7. Admin: generate payroll at /{slug}/dashboard/payroll',
  '8. Razorpay: payment.captured webhook marks payslip isPaid (or ALLOW_MANUAL_PAYROLL_MARK_PAID in staging)',
];

let passed = 0;
let failed = 0;

function log(ok, msg) {
  console.log(`${ok ? '✓' : '✗'} ${msg}`);
  if (ok) passed++;
  else failed++;
}

async function fetchJson(path, options = {}) {
  const headers = {
    ...(options.headers || {}),
    ...(cookie ? { cookie } : {}),
    ...(workspace ? { 'x-workspace-slug': workspace } : {}),
  };
  const res = await fetch(`${base}${path}`, { ...options, headers });
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { res, body };
}

async function runAutomated() {
  console.log('\n=== Automated checks ===\n');
  if (!base) {
    log(false, 'STAGING_BASE_URL is required');
    return;
  }

  {
    const { res, body } = await fetchJson('/api/health');
    log(res.ok && body?.status, `GET /api/health (${body?.status || res.status})`);
  }

  {
    const { res } = await fetchJson('/api/features/me');
    log(res.status === 401 || res.status === 403, `GET /api/features/me unauthenticated → ${res.status}`);
  }

  if (cookie) {
    const { res, body } = await fetchJson('/api/features/me');
    log(res.ok && typeof body?.modules === 'object', 'GET /api/features/me (authenticated) returns modules');
  } else {
    console.log('  (skip authenticated module check — set QA_SESSION_COOKIE)');
  }

  if (webhookSecret) {
    const resBad = await fetch(`${base}/api/emails/reply`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ from: 'qa@test.com', subject: 'Re: QA' }),
    });
    log(resBad.status === 401, 'POST /api/emails/reply without secret → 401');

    const resOk = await fetch(`${base}/api/emails/reply`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${webhookSecret}`,
      },
      body: JSON.stringify({ from: 'qa@test.com', subject: 'Re: QA' }),
    });
    log(resOk.status !== 401, 'POST /api/emails/reply with secret → not 401');
  } else {
    console.log('  (skip webhook secret checks — set INBOUND_EMAIL_WEBHOOK_SECRET)');
  }

  if (cookie && workspace) {
    const { res } = await fetchJson('/api/leave-requests?status=PENDING');
    log(res.status === 200 || res.status === 403, `GET /api/leave-requests → ${res.status}`);
    const { res: pr } = await fetchJson('/api/payrolls');
    log(pr.status === 200 || pr.status === 403, `GET /api/payrolls → ${pr.status}`);
  }
}

function printManual() {
  console.log('\n=== Manual E2E (repeat per plan tier) ===\n');
  for (const tier of PLAN_TIERS) {
    console.log(`--- Plan: ${tier} ---`);
    manualFlow.forEach((step) => console.log(`  ${step.replace('plan tier', tier)}`));
    console.log('  Verify /dashboard/settings/subscription shows correct enabled modules.\n');
  }
}

async function main() {
  console.log(`Staging QA → ${base || '(no base URL)'}`);
  await runAutomated();
  printManual();
  console.log(`\nResult: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
