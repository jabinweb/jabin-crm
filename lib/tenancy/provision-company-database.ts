import { spawn } from 'child_process';

const PROVISION_TIMEOUT_MS = 120_000;

/**
 * Apply the current Prisma schema to a tenant Postgres URL via `prisma db push`.
 * Preferable to migrate deploy for empty BYO databases (no migration history required).
 * Never logs the URL.
 */
export async function provisionCompanyDatabaseSchema(
  tenantUrl: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  return new Promise((resolve) => {
    const isWin = process.platform === 'win32';
    const cmd = isWin ? 'npx.cmd' : 'npx';
    const args = ['prisma', 'db', 'push', '--skip-generate'];

    const child = spawn(cmd, args, {
      cwd: process.cwd(),
      env: {
        ...process.env,
        DATABASE_URL: tenantUrl,
      },
      shell: isWin,
      windowsHide: true,
    });

    let stderr = '';
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGTERM');
      resolve({ ok: false, error: 'Schema provision timed out after 120s' });
    }, PROVISION_TIMEOUT_MS);

    child.stderr?.on('data', (chunk: Buffer | string) => {
      stderr += String(chunk);
      if (stderr.length > 4000) stderr = stderr.slice(-4000);
    });

    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        ok: false,
        error: err.message || 'Failed to start prisma db push',
      });
    });

    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code === 0) {
        resolve({ ok: true });
        return;
      }
      const hint = stderr
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .slice(-8)
        .join(' ');
      // Strip any accidental URL-looking tokens from error text
      const scrubbed = hint.replace(
        /postgres(?:ql)?:\/\/[^\s]+/gi,
        'postgresql://***'
      );
      resolve({
        ok: false,
        error: scrubbed || `prisma db push exited with code ${code}`,
      });
    });
  });
}
