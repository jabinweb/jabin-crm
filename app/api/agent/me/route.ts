import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { resolveCompanyContextFromRequest } from '@/lib/auth/company-membership';
import { getOrCreateCompanyAgent, refreshCompanyAgentModels } from '@/lib/agent/company-agent';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (session.user.role === 'CUSTOMER' || session.user.role === 'EMPLOYEE') {
      return NextResponse.json({ error: 'Ops Agent is for CRM staff' }, { status: 403 });
    }

    const ctx = await resolveCompanyContextFromRequest(session, req);
    const agent = await getOrCreateCompanyAgent(ctx.companyId);

    const profile = await prisma.userProfile.findUnique({
      where: { userId: session.user.id },
      select: { geminiApiKey: true },
    });
    let apiKey = process.env.GEMINI_API_KEY?.trim() || '';
    if (profile?.geminiApiKey) {
      try {
        apiKey = decrypt(profile.geminiApiKey);
      } catch {
        /* keep env */
      }
    }

    if (!apiKey) {
      return NextResponse.json({
        agent,
        listedModels: [],
        chain: [],
        error: 'No Gemini API key configured',
      });
    }

    const refreshed = await refreshCompanyAgentModels({
      companyId: ctx.companyId,
      apiKey,
    });

    return NextResponse.json({
      agent: refreshed.agent,
      listedModels: refreshed.listedModels,
      listedCount: refreshed.listedModels.length,
      listedLive: refreshed.listedLive,
      chain: refreshed.chain,
      chainLength: refreshed.chain.length,
    });
  } catch (error) {
    console.error('[api/agent/me]', error);
    return NextResponse.json({ error: 'Failed to load agent' }, { status: 500 });
  }
}
