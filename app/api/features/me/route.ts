import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { handleApiError } from '@/lib/api-error-handler';
import { getFeatureModuleMap } from '@/lib/feature-modules';

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    const modules = await getFeatureModuleMap(session.user.id);
    return NextResponse.json({ modules });
  } catch (error) {
    return handleApiError(error);
  }
}
