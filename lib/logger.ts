/**
 * Simple logger that uses console in development and can be upgraded to pino in production
 * Avoids worker thread issues with pino-pretty in Next.js dev mode
 */

const isDevelopment = process.env.NODE_ENV !== 'production';

// Simple console-based logger for development
const logger = {
  error: (obj: any, msg?: string) => {
    if (isDevelopment) {
      console.error('[ERROR]', msg || '', obj);
    } else {
      // In production, use structured logging
      console.error(JSON.stringify({ level: 'ERROR', msg, ...obj, time: new Date().toISOString() }));
    }
  },
  info: (obj: any, msg?: string) => {
    if (isDevelopment) {
      console.log('[INFO]', msg || '', obj);
    } else {
      console.log(JSON.stringify({ level: 'INFO', msg, ...obj, time: new Date().toISOString() }));
    }
  },
  warn: (obj: any, msg?: string) => {
    if (isDevelopment) {
      console.warn('[WARN]', msg || '', obj);
    } else {
      console.warn(JSON.stringify({ level: 'WARN', msg, ...obj, time: new Date().toISOString() }));
    }
  },
  debug: (obj: any, msg?: string) => {
    if (isDevelopment) {
      console.debug('[DEBUG]', msg || '', obj);
    } else {
      // Skip debug in production
    }
  },
};

export default logger;

// Helper functions for common logging patterns
export const logError = (error: unknown, context?: Record<string, any>) => {
  logger.error({ err: error, ...context }, error instanceof Error ? error.message : 'Unknown error');
};

export const logInfo = (message: string, context?: Record<string, any>) => {
  logger.info(context || {}, message);
};

export const logWarning = (message: string, context?: Record<string, any>) => {
  logger.warn(context || {}, message);
};

export const logDebug = (message: string, context?: Record<string, any>) => {
  logger.debug(context || {}, message);
};

