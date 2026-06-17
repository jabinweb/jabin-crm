import { resolveAuthUrl } from '@/lib/env-validation';

/** Canonical public base URL for emails, webhooks, and links (not OAuth callbacks). */
export function getAppBaseUrl(): string {
  return (
    resolveAuthUrl() ??
    process.env.NEXT_PUBLIC_APP_URL?.trim() ??
    'http://localhost:3000'
  );
}
