import type { TicketStatus } from '@prisma/client';
import type { SupportSettings } from '@/lib/support/ticket-types';

export const DEFAULT_STATUS_PIPELINE: TicketStatus[] = [
  'OPEN',
  'ASSIGNED',
  'IN_PROGRESS',
  'RESOLVED',
  'CLOSED',
];

export const STATUS_LABELS: Record<TicketStatus, string> = {
  OPEN: 'Open',
  ASSIGNED: 'Assigned',
  IN_PROGRESS: 'In progress',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};

/** Vertical-specific pipeline presets admins can adopt per ticket type. */
export const PIPELINE_PRESETS: Record<string, TicketStatus[]> = {
  default: DEFAULT_STATUS_PIPELINE,
  ecommerce_order: ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'],
  billing: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'],
  feature_request: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'],
};

export function getStatusPipelineForTicketType(
  ticketTypeId: string | null | undefined,
  supportSettings?: SupportSettings
): TicketStatus[] {
  if (ticketTypeId && supportSettings?.statusPipelines?.[ticketTypeId]?.length) {
    return supportSettings.statusPipelines[ticketTypeId] as TicketStatus[];
  }
  return DEFAULT_STATUS_PIPELINE;
}

export function isValidStatusTransition(
  current: TicketStatus,
  next: TicketStatus,
  pipeline: TicketStatus[]
): boolean {
  const currentIdx = pipeline.indexOf(current);
  const nextIdx = pipeline.indexOf(next);
  if (currentIdx === -1 || nextIdx === -1) return true;
  return nextIdx >= currentIdx;
}

export function getNextStatuses(
  current: TicketStatus,
  pipeline: TicketStatus[]
): TicketStatus[] {
  const idx = pipeline.indexOf(current);
  if (idx === -1) return pipeline.filter((s) => s !== current);
  return pipeline.slice(idx + 1);
}
