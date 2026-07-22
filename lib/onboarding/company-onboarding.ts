import type { BusinessVertical } from '@/lib/workspace-templates';

export const ONBOARDING_STEPS = [
  { id: 'welcome', title: 'Welcome', description: 'Confirm your business profile' },
  { id: 'support', title: 'Support desk', description: 'Optional channels — change anytime in Settings' },
  { id: 'complete', title: 'Go live', description: 'Review and launch your workspace' },
] as const;

export type OnboardingStepId = (typeof ONBOARDING_STEPS)[number]['id'];

/** Legacy step ids from older wizards — map forward so mid-flight users are not stuck. */
const LEGACY_STEP_MAP: Record<string, OnboardingStepId> = {
  team: 'complete',
  customer: 'complete',
};

export interface CompanyOnboardingState {
  completed?: boolean;
  completedAt?: string;
  currentStep?: OnboardingStepId;
  skippedSteps?: OnboardingStepId[];
  checklistDismissedAt?: string;
}

export function canManageCompanyOnboarding(role: string | null | undefined): boolean {
  return role === 'ADMIN' || role === 'SUPER_ADMIN';
}

export function normalizeOnboardingStep(step: string | undefined | null): OnboardingStepId {
  if (!step) return 'welcome';
  if (LEGACY_STEP_MAP[step]) return LEGACY_STEP_MAP[step];
  if (ONBOARDING_STEPS.some((s) => s.id === step)) return step as OnboardingStepId;
  return 'welcome';
}

export function parseOnboardingState(raw: unknown): CompanyOnboardingState {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { completed: false };
  const obj = raw as Record<string, unknown>;
  return {
    completed: obj.completed === true,
    completedAt: typeof obj.completedAt === 'string' ? obj.completedAt : undefined,
    currentStep: normalizeOnboardingStep(
      typeof obj.currentStep === 'string' ? obj.currentStep : 'welcome'
    ),
    skippedSteps: Array.isArray(obj.skippedSteps)
      ? (obj.skippedSteps.filter((s) => typeof s === 'string') as OnboardingStepId[])
      : [],
    checklistDismissedAt:
      typeof obj.checklistDismissedAt === 'string' ? obj.checklistDismissedAt : undefined,
  };
}

export function isOnboardingComplete(settings: Record<string, unknown> | null | undefined): boolean {
  if (!settings) return false;
  const onboarding = parseOnboardingState(settings.onboarding);
  return onboarding.completed === true;
}

export function nextStepId(current: OnboardingStepId): OnboardingStepId | null {
  const idx = ONBOARDING_STEPS.findIndex((s) => s.id === current);
  if (idx === -1 || idx >= ONBOARDING_STEPS.length - 1) return null;
  return ONBOARDING_STEPS[idx + 1].id;
}

export function mergeOnboardingPatch(
  existing: CompanyOnboardingState,
  patch: Partial<CompanyOnboardingState>
): CompanyOnboardingState {
  return { ...existing, ...patch };
}

/** Settings seed for SaaS-provisioned companies (no forced wizard). */
export function completedOnboardingState(): CompanyOnboardingState {
  return {
    completed: true,
    completedAt: new Date().toISOString(),
    currentStep: 'complete',
  };
}

export interface OnboardingWelcomePayload {
  businessVertical?: BusinessVertical;
  companyName?: string;
}

export interface OnboardingSupportPayload {
  channels?: {
    email?: string;
    phone?: string;
    chat?: boolean;
    whatsApp?: boolean;
  };
}
