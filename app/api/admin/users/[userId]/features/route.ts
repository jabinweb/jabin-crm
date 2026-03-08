import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { ALL_FEATURE_MODULES, getFeatureModuleMap, setFeatureModules } from '@/lib/feature-modules';

function isSuperAdmin(role?: string | null) {
  return role === 'SUPER_ADMIN' || role === 'admin';
}

const updateFeaturesSchema = z.object({
  modules: z.array(
    z.object({
      module: z.enum(ALL_FEATURE_MODULES),
      enabled: z.boolean(),
    })
  ),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || !isSuperAdmin((session.user as any).role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId } = await params;
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const modules = await getFeatureModuleMap(userId);
    return NextResponse.json({ userId, modules });
  } catch (error) {
    console.error('Error fetching feature modules:', error);
    return NextResponse.json({ error: 'Failed to fetch feature modules' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || !isSuperAdmin((session.user as any).role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId } = await params;
    const body = await req.json();
    const parsed = updateFeaturesSchema.parse(body);

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    await setFeatureModules(userId, parsed.modules);
    const modules = await getFeatureModuleMap(userId);
    return NextResponse.json({ userId, modules });
  } catch (error) {
    console.error('Error updating feature modules:', error);
    return NextResponse.json({ error: 'Failed to update feature modules' }, { status: 500 });
  }
}
