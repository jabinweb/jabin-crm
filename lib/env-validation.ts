import { z } from 'zod';
import { logError } from './logger';

// Environment variable schema
const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url().min(1, 'DATABASE_URL is required'),

  // NextAuth
  AUTH_SECRET: z.string().min(32, 'AUTH_SECRET must be at least 32 characters'),
  AUTH_URL: z.string().url('AUTH_URL must be a valid URL'),

  // Email
  EMAIL_PROVIDER: z.enum(['smtp', 'sendgrid', 'resend']),
  SMTP_HOST: z.string().min(1).optional(),
  SMTP_PORT: z.string().regex(/^\d+$/).optional(),
  SMTP_USER: z.string().email().optional(),
  SMTP_PASSWORD: z.string().min(1).optional(),
  SMTP_FROM: z.string().email().optional(),

  // IMAP
  IMAP_HOST: z.string().optional(),
  IMAP_PORT: z.string().regex(/^\d+$/).optional(),
  IMAP_USER: z.string().email().optional(),
  IMAP_PASSWORD: z.string().optional(),
  IMAP_TLS: z.string().optional(),

  // Encryption
  ENCRYPTION_KEY: z.string().min(32, 'ENCRYPTION_KEY must be at least 32 characters'),

  // OAuth
  GOOGLE_CLIENT_ID: z.string().min(1, 'GOOGLE_CLIENT_ID is required'),
  GOOGLE_CLIENT_SECRET: z.string().min(1, 'GOOGLE_CLIENT_SECRET is required'),

  // Optional
  SENTRY_DSN: z.string().url().optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  RATE_LIMIT_WINDOW_MS: z.string().regex(/^\d+$/).optional(),
  RATE_LIMIT_MAX_REQUESTS: z.string().regex(/^\d+$/).optional(),
});

export type Env = z.infer<typeof envSchema>;

let validatedEnv: Env | null = null;

/**
 * Validate environment variables on startup
 * Call this in middleware or app initialization
 */
export function validateEnv(): Env {
  if (validatedEnv) {
    return validatedEnv;
  }

  try {
    validatedEnv = envSchema.parse(process.env);
    return validatedEnv;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors.map((err) => `${err.path.join('.')}: ${err.message}`);

      logError(error, {
        missingVariables: missingVars,
      });

      console.error('\n❌ Environment validation failed:\n');
      missingVars.forEach((msg) => console.error(`  - ${msg}`));
      console.error('\n📝 Please check your .env file against .env.example\n');

      if (process.env.NODE_ENV === 'production') {
        process.exit(1); // Fail fast in production
      }
    }

    throw error;
  }
}

/**
 * Get validated environment variables
 * Safe to use after validateEnv() has been called
 */
export function getEnv(): Env {
  if (!validatedEnv) {
    return validateEnv();
  }
  return validatedEnv;
}

/**
 * Check if running in production
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Check if running in development
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}
