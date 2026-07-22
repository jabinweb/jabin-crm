import { describe, expect, it } from '@jest/globals';
import {
  canManageCompanyOnboarding,
  normalizeOnboardingStep,
  parseOnboardingState,
  completedOnboardingState,
  ONBOARDING_STEPS,
} from '@/lib/onboarding/company-onboarding';

describe('company-onboarding', () => {
  it('only ADMIN and SUPER_ADMIN manage setup', () => {
    expect(canManageCompanyOnboarding('ADMIN')).toBe(true);
    expect(canManageCompanyOnboarding('SUPER_ADMIN')).toBe(true);
    expect(canManageCompanyOnboarding('SUPPORT_MANAGER')).toBe(false);
    expect(canManageCompanyOnboarding('SALES')).toBe(false);
    expect(canManageCompanyOnboarding('TECHNICIAN')).toBe(false);
    expect(canManageCompanyOnboarding('CUSTOMER')).toBe(false);
  });

  it('maps legacy steps to complete', () => {
    expect(normalizeOnboardingStep('team')).toBe('complete');
    expect(normalizeOnboardingStep('customer')).toBe('complete');
    expect(normalizeOnboardingStep('welcome')).toBe('welcome');
  });

  it('has three wizard steps', () => {
    expect(ONBOARDING_STEPS.map((s) => s.id)).toEqual(['welcome', 'support', 'complete']);
  });

  it('parses checklist dismiss and completed SaaS seed', () => {
    const done = completedOnboardingState();
    expect(done.completed).toBe(true);
    expect(parseOnboardingState(done).completed).toBe(true);
    expect(
      parseOnboardingState({ completed: true, checklistDismissedAt: '2026-01-01' })
        .checklistDismissedAt
    ).toBe('2026-01-01');
  });
});
