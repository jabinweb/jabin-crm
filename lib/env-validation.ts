import { z } from 'zod';
import { logError, logInfo, logWarning } from './logger';

const envSchema = z
  .object({
    DATABASE_URL: z.string().url().min(1, 'DATABASE_URL is required'),
    AUTH_SECRET: z.string().min(32, 'AUTH_SECRET must be at least 32 characters'),
    AUTH_URL: z.string().url('AUTH_URL must be a valid URL'),
    EMAIL_PROVIDER: z.enum(['smtp', 'sendgrid', 'resend']).default('smtp'),
    SMTP_HOST: z.string().min(1).optional(),
    SMTP_PORT: z.string().regex(/^\d+$/).optional(),
    SMTP_USER: z.string().email().optional(),
    SMTP_PASSWORD: z.string().min(1).optional(),
    SMTP_FROM: z.string().email().optional(),
    IMAP_HOST: z.string().optional(),
    IMAP_PORT: z.string().regex(/^\d+$/).optional(),
    IMAP_USER: z.string().email().optional(),
    IMAP_PASSWORD: z.string().optional(),
    IMAP_TLS: z.string().optional(),
    ENCRYPTION_KEY: z.string().min(32, 'ENCRYPTION_KEY must be at least 32 characters'),
    GOOGLE_CLIENT_ID: z.string().min(1, 'GOOGLE_CLIENT_ID is required'),
    GOOGLE_CLIENT_SECRET: z.string().min(1, 'GOOGLE_CLIENT_SECRET is required'),
    RAZORPAY_KEY_ID: z.string().optional(),
    RAZORPAY_KEY_SECRET: z.string().optional(),
    RAZORPAY_TEST_KEY_ID: z.string().optional(),
    RAZORPAY_TEST_KEY_SECRET: z.string().optional(),
    RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
    REDIS_URL: z.string().url().optional(),
    INBOUND_EMAIL_WEBHOOK_SECRET: z.string().optional(),
    CRON_SECRET: z.string().optional(),
    SENTRY_DSN: z.string().url().optional(),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    RATE_LIMIT_WINDOW_MS: z.string().regex(/^\d+$/).optional(),
    RATE_LIMIT_MAX_REQUESTS: z.string().regex(/^\d+$/).optional(),
    ALLOW_MANUAL_PAYROLL_MARK_PAID: z
      .enum(['true', 'false'])
      .optional()
      .default('false'),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== 'production') return;

    if (env.EMAIL_PROVIDER === 'smtp') {
      const smtpFields = [
        ['SMTP_HOST', env.SMTP_HOST],
        ['SMTP_PORT', env.SMTP_PORT],
        ['SMTP_USER', env.SMTP_USER],
        ['SMTP_PASSWORD', env.SMTP_PASSWORD],
        ['SMTP_FROM', env.SMTP_FROM],
      ] as const;
      for (const [name, value] of smtpFields) {
        if (!value) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `${name} is required in production when EMAIL_PROVIDER=smtp`,
            path: [name],
          });
        }
      }
    }

    const razorpayKeyId = env.RAZORPAY_KEY_ID || env.RAZORPAY_TEST_KEY_ID;
    const razorpayKeySecret = env.RAZORPAY_KEY_SECRET || env.RAZORPAY_TEST_KEY_SECRET;
    if (!razorpayKeyId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'RAZORPAY_KEY_ID or RAZORPAY_TEST_KEY_ID is required in production',
        path: ['RAZORPAY_KEY_ID'],
      });
    }
    if (!razorpayKeySecret) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'RAZORPAY_KEY_SECRET or RAZORPAY_TEST_KEY_SECRET is required in production',
        path: ['RAZORPAY_KEY_SECRET'],
      });
    }
    if (!env.RAZORPAY_WEBHOOK_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'RAZORPAY_WEBHOOK_SECRET is required in production (subscriptions + payroll)',
        path: ['RAZORPAY_WEBHOOK_SECRET'],
      });
    }
    if (!env.CRON_SECRET || env.CRON_SECRET.length < 16) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'CRON_SECRET (min 16 chars) is required in production',
        path: ['CRON_SECRET'],
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

let validatedEnv: Env | null = null;

export function validateEnv(): Env {
  if (validatedEnv) {
    return validatedEnv;
  }

  try {
    validatedEnv = envSchema.parse(process.env);

    if (validatedEnv.NODE_ENV === 'production' && !process.env.REDIS_URL) {
      logWarning(
        'REDIS_URL is not set — API rate limiting uses in-memory store (not suitable for multi-instance production)',
        {}
      );
    } else if (process.env.REDIS_URL) {
      logInfo('Redis rate limiting configured ✓', {});
    }

    return validatedEnv;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors.map((err) => `${err.path.join('.')}: ${err.message}`);
      logError(error, { missingVariables: missingVars });
      console.error('\n❌ Environment validation failed:\n');
      missingVars.forEach((msg) => console.error(`  - ${msg}`));
      console.error('\n📝 See .env.example and docs/DEPLOYMENT.md\n');
      if (process.env.NODE_ENV === 'production' && !process.env.JEST_WORKER_ID) {
        process.exit(1);
      }
    }
    throw error;
  }
}

export function getEnv(): Env {
  if (!validatedEnv) {
    return validateEnv();
  }
  return validatedEnv;
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}

export function allowManualPayrollMarkPaid(): boolean {
  return process.env.ALLOW_MANUAL_PAYROLL_MARK_PAID === 'true';
}
