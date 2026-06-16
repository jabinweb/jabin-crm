import { describe, test, expect } from '@jest/globals';
import { ALL_FEATURE_MODULES } from '../feature-module-keys';

describe('Subscription module keys', () => {
  test('does not include HRMS modules (company-internal)', () => {
    const keys = ALL_FEATURE_MODULES as readonly string[];
    expect(keys).not.toContain('HR_ATTENDANCE');
    expect(keys).not.toContain('HR_PAYROLL');
    expect(keys).not.toContain('HR_LEAVE');
  });

  test('includes core CRM and support modules', () => {
    expect(ALL_FEATURE_MODULES).toContain('LEADS');
    expect(ALL_FEATURE_MODULES).toContain('TICKETS');
    expect(ALL_FEATURE_MODULES).toContain('EMAIL_OUTREACH');
  });
});
