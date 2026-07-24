import { LEAD_STAGE_DEFS } from './defaults';

/** Map industry template flow keys → Prisma LeadStatus IDs. */
export const LEAD_FLOW_TO_STATUS: Record<string, string> = {
  NEW: 'NEW',
  CONTACTED: 'CONTACTED',
  RESPONDED: 'RESPONDED',
  SITE_VISIT: 'CONTACTED',
  DISCOVERY: 'CONTACTED',
  INTERESTED: 'CONTACTED',
  INQUIRY: 'CONTACTED',
  DEMO: 'RESPONDED',
  QUALIFIED: 'QUALIFIED',
  RFQ: 'QUALIFIED',
  SCOPING: 'QUALIFIED',
  TRIAL: 'QUALIFIED',
  ENROLLED: 'QUALIFIED',
  PROPOSAL: 'PROPOSAL',
  QUOTE: 'PROPOSAL',
  QUOTED: 'PROPOSAL',
  ESTIMATE: 'PROPOSAL',
  NEGOTIATION: 'NEGOTIATION',
  CONTRACT: 'NEGOTIATION',
  PO: 'NEGOTIATION',
  PROCUREMENT: 'NEGOTIATION',
  SCHEDULED: 'NEGOTIATION',
  IN_PRODUCTION: 'NEGOTIATION',
  BOOKED: 'NEGOTIATION',
  ORDER: 'NEGOTIATION',
  ACTIVE: 'NEGOTIATION',
  WON: 'WON',
  LOST: 'LOST',
  CHURN_RISK: 'ON_HOLD',
  ON_HOLD: 'ON_HOLD',
  CONVERTED: 'CONVERTED',
  UNSUBSCRIBED: 'UNSUBSCRIBED',
};

const ALLOWED = new Set(LEAD_STAGE_DEFS.map((s) => s.id));

function humanizeFlowKey(key: string): string {
  return key
    .split('_')
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Convert a template leadStatusFlow into company pipeline stages + labels
 * that only use valid LeadStatus enum IDs.
 */
export function leadFlowToPipelineConfig(flow: string[]): {
  stages: string[];
  labels: Record<string, string>;
} {
  const stages: string[] = [];
  const labels: Record<string, string> = {};
  const seen = new Set<string>();

  for (const raw of flow) {
    if (typeof raw !== 'string') continue;
    const key = raw.trim().toUpperCase();
    if (!key) continue;
    const status = LEAD_FLOW_TO_STATUS[key] ?? (ALLOWED.has(key) ? key : null);
    if (!status || !ALLOWED.has(status) || seen.has(status)) continue;
    seen.add(status);
    stages.push(status);
    if (key !== status) {
      labels[status] = humanizeFlowKey(key);
    }
  }

  if (stages.length === 0) {
    return {
      stages: LEAD_STAGE_DEFS.map((s) => s.id),
      labels: {},
    };
  }

  // Always keep terminal outcomes available for board moves
  for (const terminal of ['WON', 'LOST'] as const) {
    if (!seen.has(terminal)) {
      stages.push(terminal);
      seen.add(terminal);
    }
  }

  return { stages, labels };
}
