import { NextResponse } from 'next/server';
import type { Session } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { hasLegacyRole, hasPermissionOrRole } from '@/lib/auth/permissions';
import { isFeatureEnabled } from '@/lib/feature-modules';
import { FEATURE_MODULE_LABELS, type FeatureModuleKey } from '@/lib/feature-module-keys';
import {
  resolveWorkspaceConfig,
  workspaceSettingsFromCompanySettings,
} from '@/lib/workspace-config';
import type { WorkspaceFeatureKey } from '@/lib/workspace-templates';

/**
 * Shared access checks for finance / sales-document / inventory / ops APIs, so every
 * route applies the same rule as the sidebar (role list + plan module + workspace feature).
 */

export const COMPANY_ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN'] as const;
/** Roles the nav offers sales documents, the catalog and contracts to. */
export const SALES_DOC_ROLES = ['ADMIN', 'SUPER_ADMIN', 'SALES', 'SUPPORT_MANAGER'] as const;

export function isCompanyAdminSession(session: Session | null | undefined): boolean {
  return hasLegacyRole(session ?? null, ...COMPANY_ADMIN_ROLES);
}

export function isCustomerSession(session: Session | null | undefined): boolean {
  return hasLegacyRole(session ?? null, 'CUSTOMER');
}

function forbidden(error: string) {
  return NextResponse.json({ error }, { status: 403 });
}

/** Workspace (vertical) feature flags for a company, as the client's useWorkspaceConfig sees them. */
export async function workspaceFeaturesForCompany(
  companyId: string
): Promise<Record<WorkspaceFeatureKey, boolean>> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { settings: true },
  });
  const stored =
    company?.settings && typeof company.settings === 'object' && !Array.isArray(company.settings)
      ? (company.settings as Record<string, unknown>)
      : {};
  return resolveWorkspaceConfig(workspaceSettingsFromCompanySettings(stored)).features;
}

export type OpsAccessOptions = {
  /** Allowed legacy roles (CUSTOMER is always refused unless listed). Omit = any staff role. */
  roles?: readonly string[];
  /** RBAC permission checked via hasPermissionOrRole (legacy fallback: `roles` or ADMIN/SUPER_ADMIN). */
  permission?: string;
  /** Plan module that must be on for the request's workspace. */
  module?: FeatureModuleKey;
  /** Workspace feature that must be on (use for writes). */
  feature?: WorkspaceFeatureKey;
};

/**
 * Returns a 403 response when the caller may not use the route, or null when allowed.
 */
export async function checkOpsAccess(
  session: Session,
  companyId: string | null | undefined,
  options: OpsAccessOptions = {}
): Promise<NextResponse | null> {
  const role = (session.user as { role?: string } | undefined)?.role;
  if (role === 'CUSTOMER' && !options.roles?.includes('CUSTOMER')) {
    return forbidden('Forbidden');
  }

  if (options.permission) {
    const legacy = options.roles ? [...options.roles] : [...COMPANY_ADMIN_ROLES];
    const allowed = await hasPermissionOrRole(session, options.permission, ...legacy);
    if (!allowed) return forbidden('Forbidden');
  } else if (options.roles && !hasLegacyRole(session, ...options.roles)) {
    return forbidden('Forbidden');
  }

  if (options.module) {
    const enabled = await isFeatureEnabled(session.user.id, options.module, companyId);
    if (!enabled) {
      return forbidden(
        `Feature "${FEATURE_MODULE_LABELS[options.module]}" is not included in your subscription plan.`
      );
    }
  }

  if (options.feature && companyId) {
    const features = await workspaceFeaturesForCompany(companyId);
    if (features[options.feature] !== true) {
      return forbidden('This feature is not enabled for this workspace.');
    }
  }

  return null;
}
