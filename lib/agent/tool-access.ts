import type { FeatureModuleKey } from '@/lib/feature-module-keys';

// ── Access policy ─────────────────────────────────────────────────────────
// One table that mirrors the nav + REST rules for each tool: which roles may call it and
// which plan modules must be on. Tools missing here fall back to their own `roles`.
const ALL_STAFF = ['ADMIN', 'SUPER_ADMIN', 'SALES', 'SUPPORT_MANAGER', 'TECHNICIAN'];
const CRM_STAFF = ['ADMIN', 'SUPER_ADMIN', 'SALES', 'SUPPORT_MANAGER'];
const SUPPORT_LEADS = ['ADMIN', 'SUPER_ADMIN', 'SUPPORT_MANAGER'];
const ADMINS = ['ADMIN', 'SUPER_ADMIN'];
// Project delivery: everyone on the Projects nav reads; task writes also need project
// membership (checked in the tool); project settings/team/milestones are for managers
const PROJECT_READERS = ALL_STAFF;
const PROJECT_WRITERS = ['ADMIN', 'SUPER_ADMIN', 'SALES', 'TECHNICIAN'];
const PROJECT_MANAGERS = ['ADMIN', 'SUPER_ADMIN', 'SALES'];

type ToolAccess = { roles: string[]; modules?: FeatureModuleKey[] };

export const AGENT_TOOL_ACCESS: Record<string, ToolAccess> = {
  get_company_snapshot: { roles: ALL_STAFF },
  list_overdue_invoices: { roles: CRM_STAFF, modules: ['INVOICES'] },
  list_open_tickets: { roles: ALL_STAFF, modules: ['TICKETS'] },
  list_open_deals: { roles: CRM_STAFF, modules: ['DEALS'] },
  list_pending_quotations: { roles: CRM_STAFF, modules: ['QUOTATIONS'] },
  search_customers: { roles: CRM_STAFF },
  search_leads: { roles: CRM_STAFF, modules: ['LEADS'] },
  get_invoice: { roles: CRM_STAFF, modules: ['INVOICES'] },
  create_task: { roles: CRM_STAFF },
  add_lead_note: { roles: CRM_STAFF, modules: ['LEADS'] },
  record_invoice_payment: { roles: ['ADMIN', 'SUPER_ADMIN', 'SALES'], modules: ['INVOICES'] },
  qualify_lead_ai: { roles: CRM_STAFF, modules: ['LEADS'] },
  suggest_tasks_ai: { roles: CRM_STAFF },
  search_team_members: { roles: ALL_STAFF },
  send_team_message: { roles: ALL_STAFF },
  get_customer: { roles: CRM_STAFF },
  get_ticket: { roles: ALL_STAFF, modules: ['TICKETS'] },
  get_lead: { roles: CRM_STAFF, modules: ['LEADS'] },
  get_deal: { roles: CRM_STAFF, modules: ['DEALS'] },
  list_expiring_contracts: { roles: CRM_STAFF, modules: ['TICKETS'] },
  list_unassigned_tickets: { roles: ALL_STAFF, modules: ['TICKETS'] },
  list_pending_expenses: { roles: SUPPORT_LEADS, modules: ['SERVICE_EXPENSES'] },
  list_email_sequences: { roles: CRM_STAFF, modules: ['EMAIL_OUTREACH'] },
  company_kpi_today: { roles: CRM_STAFF },
  create_ticket: { roles: ALL_STAFF, modules: ['TICKETS'] },
  update_ticket_status: { roles: ALL_STAFF, modules: ['TICKETS'] },
  assign_ticket: { roles: ALL_STAFF, modules: ['TICKETS'] },
  create_deal: { roles: CRM_STAFF, modules: ['DEALS'] },
  update_deal_stage: { roles: CRM_STAFF, modules: ['DEALS'] },
  update_lead_status: { roles: CRM_STAFF, modules: ['LEADS'] },
  assign_lead: { roles: CRM_STAFF, modules: ['LEADS'] },
  create_quotation: { roles: CRM_STAFF, modules: ['QUOTATIONS'] },
  send_quotation: { roles: CRM_STAFF, modules: ['QUOTATIONS'] },
  create_invoice: { roles: CRM_STAFF, modules: ['INVOICES'] },
  send_invoice: { roles: CRM_STAFF, modules: ['INVOICES'] },
  enroll_lead_in_sequence: { roles: CRM_STAFF, modules: ['EMAIL_OUTREACH', 'LEADS'] },
  schedule_calendar_event: { roles: CRM_STAFF },
  send_whatsapp_message: { roles: ALL_STAFF, modules: ['WHATSAPP'] },
  approve_expense: { roles: SUPPORT_LEADS, modules: ['SERVICE_EXPENSES'] },
  create_announcement: { roles: ADMINS },
  get_contract: { roles: CRM_STAFF, modules: ['TICKETS'] },
  list_sla_breaches: { roles: SUPPORT_LEADS, modules: ['SUPPORT_SLA'] },
  list_technician_locations: { roles: SUPPORT_LEADS, modules: ['SERVICE_GPS'] },
  attendance_today: { roles: ADMINS },
  list_unread_notifications: { roles: ALL_STAFF },
  search_documents: { roles: CRM_STAFF },
  list_assets: { roles: ADMINS },
  list_inventory: { roles: CRM_STAFF, modules: ['INVENTORY'] },
  payroll_summary: { roles: ADMINS },
  draft_email: { roles: CRM_STAFF },
  send_email: { roles: CRM_STAFF },
  pause_sequence: { roles: CRM_STAFF, modules: ['EMAIL_OUTREACH'] },
  create_service_report: {
    roles: ['ADMIN', 'SUPER_ADMIN', 'SUPPORT_MANAGER', 'TECHNICIAN'],
    modules: ['SERVICE_REPORTS'],
  },
  create_customer: { roles: CRM_STAFF },
  create_lead: { roles: CRM_STAFF, modules: ['LEADS'] },
  list_projects: { roles: PROJECT_READERS },
  get_project: { roles: PROJECT_READERS },
  list_project_tasks: { roles: PROJECT_READERS },
  get_project_task: { roles: PROJECT_READERS },
  create_project: { roles: PROJECT_MANAGERS },
  update_project: { roles: PROJECT_MANAGERS },
  add_project_member: { roles: PROJECT_MANAGERS },
  remove_project_member: { roles: PROJECT_MANAGERS },
  add_project_milestone: { roles: PROJECT_MANAGERS },
  update_project_milestone: { roles: PROJECT_MANAGERS },
  delete_project_milestone: { roles: PROJECT_MANAGERS },
  create_project_task: { roles: PROJECT_WRITERS },
  update_project_task: { roles: PROJECT_WRITERS },
  delete_project_task: { roles: PROJECT_WRITERS },
  add_task_comment: { roles: PROJECT_WRITERS },
  log_task_hours: { roles: PROJECT_WRITERS },
};

/**
 * Whether a role may call a tool. Kept free of tool implementations (and their heavy
 * imports) so it can be unit-tested; getToolsForRole applies it to the registry.
 */
export function canRoleUseTool(
  name: string,
  role: string,
  modules?: Partial<Record<FeatureModuleKey, boolean>> | null,
  fallbackRoles: string[] = []
): boolean {
  if (role === 'CUSTOMER') return false;
  const access = AGENT_TOOL_ACCESS[name];
  const roles = access?.roles ?? fallbackRoles;
  if (role !== 'SUPER_ADMIN' && roles.length > 0 && !roles.includes(role)) return false;
  if (modules && access?.modules?.some((m) => modules[m] !== true)) return false;
  return true;
}
