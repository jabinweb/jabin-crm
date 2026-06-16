import * as Sentry from '@sentry/nextjs';

/**
 * Sentry configuration for server-side error tracking
 * Add NEXT_PUBLIC_SENTRY_DSN to your .env file to enable
 */

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    
    // Environment
    environment: process.env.NODE_ENV || 'development',
    
    // Adjust sample rate for production
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    
    // Ignore common errors that don't need tracking
    ignoreErrors: [
      // Browser extensions
      'top.GLOBALS',
      // Random plugins/extensions
      'originalCreateNotification',
      'canvas.contentDocument',
      'MyApp_RemoveAllHighlights',
      // Network errors
      'NetworkError',
      'Network request failed',
      // React hydration mismatches (often not critical)
      'Hydration failed',
      'Text content does not match',
    ],
    
    // Don't send sensitive data
    beforeSend(event, hint) {
      // Filter out sensitive information from error messages
      if (event.message) {
        event.message = event.message.replace(/password=\w+/gi, 'password=***');
        event.message = event.message.replace(/token=\w+/gi, 'token=***');
      }
      
      // Remove sensitive headers
      if (event.request?.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['cookie'];
      }
      
      return event;
    },
  });
}

