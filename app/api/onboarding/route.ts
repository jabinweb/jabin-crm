import { handleRouteError } from '@/lib/api/tenant-response';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import {
  resolveCompanyContextFromRequest,
} from '@/lib/auth/company-membership';
import {
  parseOnboardingState,
  mergeOnboardingPatch,
  ONBOARDING_STEPS,
  nextStepId,
  normalizeOnboardingStep,
  canManageCompanyOnboarding,
  type OnboardingStepId,
} from '@/lib/onboarding/company-onboarding';
import { parseWorkspaceSettings } from '@/lib/workspace-config';
import { parseSupportSettings } from '@/lib/support/ticket-types';
import { isBusinessVertical, BUSINESS_VERTICAL_OPTIONS } from '@/lib/workspace-templates';

function settingsRecord(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return { ...(raw as Record<string, unknown>) };
  }
  return {};
}

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

    const stored = settingsRecord(company.settings);
    const onboarding = parseOnboardingState(stored.onboarding);
    const workspace = parseWorkspaceSettings(stored.workspace);
    const support = parseSupportSettings(stored.support);
    const role = session.user.role ?? '';

    return NextResponse.json({
      company: { name: company.name, status: company.status },
      onboarding,
      workspace,
      support,
      steps: ONBOARDING_STEPS,
      templates: BUSINESS_VERTICAL_OPTIONS,
      canManage: canManageCompanyOnboarding(role),
      role,
    });
  } catch (error) {
    console.error('[api/onboarding GET]', error);
    return handleRouteError(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = session.user.role ?? '';
    if (!canManageCompanyOnboarding(role)) {
      return NextResponse.json(
        { error: 'Only workspace admins can change onboarding' },
        { status: 403 }
      );
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

    const stored = settingsRecord(company.settings);
    const onboarding = parseOnboardingState(stored.onboarding);
    const step = body.step
      ? normalizeOnboardingStep(String(body.step))
      : undefined;
    const action = body.action as
      | 'complete'
      | 'skip'
      | 'finish'
      | 'dismissChecklist'
      | undefined;

    if (action === 'dismissChecklist') {
      stored.onboarding = mergeOnboardingPatch(onboarding, {
        checklistDismissedAt: new Date().toISOString(),
      });
    } else if (action === 'finish') {
      stored.onboarding = mergeOnboardingPatch(onboarding, {
        completed: true,
        completedAt: new Date().toISOString(),
        currentStep: 'complete',
      });
    } else if (step && action === 'complete') {
      if (step === 'welcome' && body.data) {
        const vertical = body.data.businessVertical;
        stored.workspace = {
          ...(typeof stored.workspace === 'object' && stored.workspace
            ? (stored.workspace as Record<string, unknown>)
            : {}),
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
        stored.support = {
          ...(typeof stored.support === 'object' && stored.support
            ? (stored.support as Record<string, unknown>)
            : {}),
          channels: body.data.channels,
        };
      }

      const next = nextStepId(step as OnboardingStepId) ?? 'complete';
      stored.onboarding = mergeOnboardingPatch(onboarding, { currentStep: next });
    } else if (step && action === 'skip') {
      const skipped = new Set(onboarding.skippedSteps ?? []);
      skipped.add(step as OnboardingStepId);
      const next = nextStepId(step as OnboardingStepId) ?? 'complete';
      stored.onboarding = mergeOnboardingPatch(onboarding, {
        currentStep: next,
        skippedSteps: Array.from(skipped),
      });
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
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
    console.error('[api/onboarding PATCH]', error);
    return handleRouteError(error);
  }
}
