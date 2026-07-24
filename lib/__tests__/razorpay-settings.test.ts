import { describe, expect, it } from '@jest/globals';
import { resolveCompanyRazorpaySettings } from '@/lib/razorpay';

describe('resolveCompanyRazorpaySettings', () => {
  it('reads integrations.razorpay test credentials', () => {
    const creds = resolveCompanyRazorpaySettings({
      integrations: {
        razorpay: {
          enabled: true,
          mode: 'test',
          credentials: {
            test: { keyId: 'rzp_test_1', keySecret: 'secret_test', webhookSecret: 'wh' },
            live: { keyId: 'rzp_live_1', keySecret: 'secret_live', webhookSecret: 'wh' },
          },
        },
      },
    });
    expect(creds).toEqual({
      enabled: true,
      keyId: 'rzp_test_1',
      keySecret: 'secret_test',
    });
  });

  it('falls back to payroll.razorpay', () => {
    const creds = resolveCompanyRazorpaySettings({
      payroll: {
        razorpay: {
          enabled: true,
          keyId: 'rzp_pay_1',
          keySecret: 'secret_pay',
        },
      },
    });
    expect(creds?.keyId).toBe('rzp_pay_1');
    expect(creds?.keySecret).toBe('secret_pay');
  });

  it('returns null when disabled', () => {
    expect(
      resolveCompanyRazorpaySettings({
        integrations: { razorpay: { enabled: false } },
      })
    ).toBeNull();
  });
});
