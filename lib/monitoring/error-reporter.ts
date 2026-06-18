import { prisma } from '@/lib/prisma';
import { logError } from '@/lib/logger';

export type ErrorReportContext = {
  digest?: string;
  pathname?: string;
  userId?: string;
  companyId?: string;
  source?: string;
  metadata?: Record<string, unknown>;
};

/**
 * Lightweight production error capture (replaces removed Sentry tunnel).
 * Persists to AuditLog when possible; always structured-logs.
 */
export async function reportError(error: unknown, context: ErrorReportContext = {}) {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;

  logError(error, {
    digest: context.digest,
    pathname: context.pathname,
    userId: context.userId,
    companyId: context.companyId,
    source: context.source ?? 'app',
    ...context.metadata,
  });

  const webhook = process.env.ERROR_WEBHOOK_URL;
  if (webhook) {
    fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        level: 'error',
        message,
        stack,
        ...context,
        time: new Date().toISOString(),
      }),
    }).catch(() => undefined);
  }

  try {
    await prisma.auditLog.create({
      data: {
        userId: context.userId,
        action: 'ERROR',
        resource: context.source ?? 'application',
        resourceId: context.digest,
        status: 'error',
        errorMessage: message.slice(0, 2000),
        metadata: {
          stack: stack?.slice(0, 4000),
          pathname: context.pathname,
          companyId: context.companyId,
          ...(context.metadata ?? {}),
        },
      },
    });
  } catch (dbErr) {
    logError(dbErr, { context: 'Failed to persist error to AuditLog' });
  }
}
