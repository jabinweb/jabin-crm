import type { BusinessVertical } from '@/lib/workspace-templates';

export const ONBOARDING_STEPS = [
  { id: 'welcome', title: 'Welcome', description: 'Confirm your business profile' },
  { id: 'support', title: 'Support desk', description: 'Configure channels and categories' },
  { id: 'team', title: 'Your team', description: 'Invite agents or skip for now' },
  { id: 'customer', title: 'First customer', description: 'Add a portal customer' },
  { id: 'complete', title: 'Go live', description: 'Review and launch' },
] as const;

export type OnboardingStepId = (typeof ONBOARDING_STEPS)[number]['id'];

export interface CompanyOnboardingState {
  completed?: boolean;
  completedAt?: string;
  currentStep?: OnboardingStepId;
  skippedSteps?: OnboardingStepId[];
}

export function parseOnboardingState(raw: unknown): CompanyOnboardingState {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { completed: false };
  const obj = raw as Record<string, unknown>;
  return {
    completed: obj.completed === true,
    completedAt: typeof obj.completedAt === 'string' ? obj.completedAt : undefined,
    currentStep: typeof obj.currentStep === 'string' ? (obj.currentStep as OnboardingStepId) : 'welcome',
    skippedSteps: Array.isArray(obj.skippedSteps)
      ? (obj.skippedSteps.filter((s) => typeof s === 'string') as OnboardingStepId[])
      : [],
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

export interface OnboardingCustomerPayload {
  organizationName?: string;
  contactPerson?: string;
  email?: string;
}
