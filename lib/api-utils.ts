import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { TenantError } from '@/lib/auth/company-membership';

export type ApiHandler = (req: NextRequest, user: any) => Promise<Response | void>;

export function createApiHandler(handler: ApiHandler) {
  return async (req: NextRequest) => {
    try {
      const session = await auth();
      if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      return await handler(req, session.user);
    } catch (error: any) {
      console.error('[API Error]', error);
      const status =
        error instanceof TenantError ? error.status : typeof error?.status === 'number' ? error.status : 500;
      const body: Record<string, unknown> = {
        error: error instanceof Error ? error.message : 'Internal Server Error',
        details: process.env.NODE_ENV === 'development' ? error : undefined,
      }
      if (error instanceof TenantError && error.code) {
        body.code = error.code
      }
      return NextResponse.json(body, { status })
    }
  };
}
