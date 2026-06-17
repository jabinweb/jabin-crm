/**
 * Instrumentation file for Next.js
 * This runs once when the Next.js server starts
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { validateEnv } = await import('./lib/env-validation');
    const { logInfo, logError } = await import('./lib/logger');

    try {
      logInfo('Validating environment variables...', {});
      validateEnv();
      logInfo('Environment validation passed ✓', {});
    } catch (error) {
      logError(error, { context: 'Environment validation failed' });

      if (process.env.NODE_ENV === 'production') {
        process.exit(1);
      }
    }
  }
}
