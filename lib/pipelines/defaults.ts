import type { PipelineKind, PipelineStageDef } from './types';

export const LEAD_STAGE_DEFS: PipelineStageDef[] = [
  { id: 'NEW', label: 'New', color: 'bg-slate-500' },
  { id: 'CONTACTED', label: 'Contacted', color: 'bg-sky-500' },
  { id: 'RESPONDED', label: 'Responded', color: 'bg-cyan-500' },
  { id: 'QUALIFIED', label: 'Qualified', color: 'bg-blue-500' },
  { id: 'PROPOSAL', label: 'Proposal', color: 'bg-violet-500' },
  { id: 'NEGOTIATION', label: 'Negotiation', color: 'bg-orange-500' },
  { id: 'WON', label: 'Won', color: 'bg-emerald-500' },
  { id: 'CONVERTED', label: 'Converted', color: 'bg-green-600' },
  { id: 'LOST', label: 'Lost', color: 'bg-red-500' },
  { id: 'ON_HOLD', label: 'On hold', color: 'bg-amber-500' },
  { id: 'UNSUBSCRIBED', label: 'Unsubscribed', color: 'bg-zinc-500' },
];

export const DEAL_STAGE_DEFS: PipelineStageDef[] = [
  { id: 'PROSPECTING', label: 'Prospecting', color: 'bg-gray-500' },
  { id: 'QUALIFICATION', label: 'Qualification', color: 'bg-blue-500' },
  { id: 'PROPOSAL', label: 'Proposal', color: 'bg-purple-500' },
  { id: 'NEGOTIATION', label: 'Negotiation', color: 'bg-orange-500' },
  { id: 'CLOSED_WON', label: 'Closed won', color: 'bg-green-500' },
  { id: 'CLOSED_LOST', label: 'Closed lost', color: 'bg-red-500' },
];

export const TICKET_STAGE_DEFS: PipelineStageDef[] = [
  { id: 'OPEN', label: 'Open', color: 'bg-sky-500' },
  { id: 'ASSIGNED', label: 'Assigned', color: 'bg-blue-500' },
  { id: 'IN_PROGRESS', label: 'In progress', color: 'bg-amber-500' },
  { id: 'RESOLVED', label: 'Resolved', color: 'bg-emerald-500' },
  { id: 'CLOSED', label: 'Closed', color: 'bg-zinc-500' },
];

export const PO_STAGE_DEFS: PipelineStageDef[] = [
  { id: 'DRAFT', label: 'Draft', color: 'bg-slate-500' },
  { id: 'SENT', label: 'Sent', color: 'bg-blue-500' },
  { id: 'RECEIVED', label: 'Received', color: 'bg-green-500' },
  { id: 'CANCELLED', label: 'Cancelled', color: 'bg-red-500' },
];

export const SO_STAGE_DEFS: PipelineStageDef[] = [
  { id: 'PENDING', label: 'Pending', color: 'bg-slate-500' },
  { id: 'PROCESSING', label: 'Processing', color: 'bg-blue-500' },
  { id: 'SHIPPED', label: 'Shipped', color: 'bg-violet-500' },
  { id: 'DELIVERED', label: 'Delivered', color: 'bg-green-500' },
  { id: 'CANCELLED', label: 'Cancelled', color: 'bg-red-500' },
];

export const PIPELINE_DEFS: Record<PipelineKind, PipelineStageDef[]> = {
  leads: LEAD_STAGE_DEFS,
  deals: DEAL_STAGE_DEFS,
  tickets: TICKET_STAGE_DEFS,
  purchase_orders: PO_STAGE_DEFS,
  sales_orders: SO_STAGE_DEFS,
};

export const PIPELINE_KIND_LABELS: Record<PipelineKind, string> = {
  leads: 'Leads',
  deals: 'Deals',
  tickets: 'Tickets',
  purchase_orders: 'Purchase orders',
  sales_orders: 'Sales orders',
};

export const ALL_PIPELINE_KINDS: PipelineKind[] = [
  'leads',
  'deals',
  'tickets',
  'purchase_orders',
  'sales_orders',
];
