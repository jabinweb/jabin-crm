import { auth } from '@/auth';
import { ApiErrors } from '@/lib/api-error-handler';
import { guardAgentFeature } from '@/lib/api/subscription-guards';
import type { FeatureModuleKey } from '@/lib/feature-module-keys';

/**
 * Require a subscription-gated CRM module on employee API routes (e.g. LEADS).
 * HRMS routes (attendance, payroll, leave) use auth + company membership only —
 * do not call this helper for those.
 */
export async function requireEmployeeModule(module: FeatureModuleKey) {
  const session = await auth();
  if (!session?.user?.id) {
    throw ApiErrors.unauthorized();
  }

  const isStaff =
    !!session.user.employeeId ||
    session.user.role === 'ADMIN' ||
    session.user.role === 'SUPER_ADMIN' ||
    session.user.role === 'SALES' ||
    session.user.role === 'SUPPORT_MANAGER';

  if (!isStaff) {
    throw ApiErrors.unauthorized();
  }

  await guardAgentFeature(session.user, module);
  return session;
}
