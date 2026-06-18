import { handleRouteError } from '@/lib/api/tenant-response';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import {
  resolveCompanyContextFromRequest,
  TenantError,
} from '@/lib/auth/company-membership';
import {
  parseOnboardingState,
  mergeOnboardingPatch,
  ONBOARDING_STEPS,
  type OnboardingStepId,
} from '@/lib/onboarding/company-onboarding';
import { parseWorkspaceSettings } from '@/lib/workspace-config';
import { parseSupportSettings } from '@/lib/support/ticket-types';
import { isBusinessVertical, BUSINESS_VERTICAL_OPTIONS } from '@/lib/workspace-templates';
import { customerService } from '@/lib/crm/customer-service';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { companyId } = await resolveCompanyContextFromRequest(session, req);
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true, status: true, settings: true },
    });

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const stored =
      company.settings && typeof company.settings === 'object' && !Array.isArray(company.settings)
        ? (company.settings as Record<string, unknown>)
        : {};

    const onboarding = parseOnboardingState(stored.onboarding);
    const workspace = parseWorkspaceSettings(stored.workspace);
    const support = parseSupportSettings(stored.support);

    return NextResponse.json({
      company: { name: company.name, status: company.status },
      onboarding,
      workspace,
      support,
      steps: ONBOARDING_STEPS,
      templates: BUSINESS_VERTICAL_OPTIONS,
    });
  } catch (error) {
    return handleRouteError(error);
    console.error('[api/onboarding GET]', error);
    return NextResponse.json({ error: 'Failed to load onboarding' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { companyId } = await resolveCompanyContextFromRequest(session, req);
    const body = await req.json();

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { settings: true, name: true },
    });
    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const stored =
      company.settings && typeof company.settings === 'object' && !Array.isArray(company.settings)
        ? ({ ...(company.settings as Record<string, unknown>) })
        : {};

    const onboarding = parseOnboardingState(stored.onboarding);
    const step = body.step as OnboardingStepId | undefined;
    const action = body.action as 'complete' | 'skip' | 'finish' | undefined;

    if (action === 'finish') {
      stored.onboarding = mergeOnboardingPatch(onboarding, {
        completed: true,
        completedAt: new Date().toISOString(),
        currentStep: 'complete',
      });
    } else if (step && action === 'complete') {
      const patch: Record<string, unknown> = { ...stored };

      if (step === 'welcome' && body.data) {
        const vertical = body.data.businessVertical;
        patch.workspace = {
          ...(typeof stored.workspace === 'object' ? stored.workspace : {}),
          businessVertical: isBusinessVertical(vertical) ? vertical : 'general',
        };
        if (body.data.companyName) {
          await prisma.company.update({
            where: { id: companyId },
            data: { name: String(body.data.companyName) },
          });
        }
      }

      if (step === 'support' && body.data?.channels) {
        patch.support = {
          ...(typeof stored.support === 'object' ? stored.support : {}),
          channels: body.data.channels,
        };
      }

      if (step === 'customer' && body.data) {
        const { organizationName, contactPerson, email } = body.data;
        if (organizationName && contactPerson) {
          await customerService.createCustomer({
            organizationName: String(organizationName),
            contactPerson: String(contactPerson),
            email: email ? String(email) : undefined,
            companyId,
          });
        }
      }

      const nextStep = ONBOARDING_STEPS[ONBOARDING_STEPS.findIndex((s) => s.id === step) + 1]?.id ?? 'complete';
      patch.onboarding = mergeOnboardingPatch(onboarding, { currentStep: nextStep });
      Object.assign(stored, patch);
    } else if (step && action === 'skip') {
      const skipped = new Set(onboarding.skippedSteps ?? []);
      skipped.add(step);
      const nextStep = ONBOARDING_STEPS[ONBOARDING_STEPS.findIndex((s) => s.id === step) + 1]?.id ?? 'complete';
      stored.onboarding = mergeOnboardingPatch(onboarding, {
        currentStep: nextStep,
        skippedSteps: Array.from(skipped),
      });
    }

    await prisma.company.update({
      where: { id: companyId },
      data: { settings: stored },
    });

    return NextResponse.json({
      ok: true,
      onboarding: parseOnboardingState(stored.onboarding),
    });
  } catch (error) {
    return handleRouteError(error);
    console.error('[api/onboarding PATCH]', error);
    return NextResponse.json({ error: 'Failed to update onboarding' }, { status: 500 });
  }
}
