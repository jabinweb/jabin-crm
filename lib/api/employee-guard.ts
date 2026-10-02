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

  // Employee self-service is scoped by the caller's employee profile. Without one,
  // queries filtered by `employeeId: undefined` would match every employee's rows.
  if (!session.user.employeeId || session.user.role === 'CUSTOMER') {
    throw ApiErrors.forbidden('An employee profile is required');
  }

  await guardAgentFeature(session.user, module);
  return session;
}
