import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { generateCampaignEmail } from '@/lib/ai/ai-service';
import { prisma } from '@/lib/prisma';
import { DEFAULT_TEXT_MODEL } from '@/lib/ai/generate';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { leadIds, campaignGoal, tone, yourCompany, yourService } = body;

    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      return NextResponse.json(
        { error: 'Please select at least one lead' },
        { status: 400 }
      );
    }

    // Fetch user profile to get API key and AI model preference
    const profile = await prisma.userProfile.findUnique({
      where: { userId: session.user.id },
      select: { geminiApiKey: true, aiModel: true },
    });

    // Decrypt API key if user has one
    let userApiKey: string | undefined = undefined;
    if (profile?.geminiApiKey) {
      try {
        const { decrypt } = require('@/lib/encryption');
        const decryptedKey = decrypt(profile.geminiApiKey);
        // Ensure the key is clean ASCII and trim whitespace
        userApiKey = decryptedKey.trim();
        if (userApiKey) {
          console.log('Using custom API key:', userApiKey.substring(0, 10) + '...');
        }
      } catch (error) {
        console.error('Failed to decrypt API key:', error);
        // Fall back to env key
      }
    }

    // Debug logging
    console.log('Profile has geminiApiKey:', !!profile?.geminiApiKey);
    console.log('User API key after decrypt:', userApiKey ? userApiKey.substring(0, 15) + '...' : 'undefined');
    console.log('Env API key:', process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.substring(0, 15) + '...' : 'undefined');
    console.log('Model to use:', profile?.aiModel || DEFAULT_TEXT_MODEL);

    // Fetch the selected leads
    const leads = await prisma.lead.findMany({
      where: {
        id: { in: leadIds },
        userId: session.user.id,
      },
      select: {
        companyName: true,
        industry: true,
        status: true,
        source: true,
      },
    });

    if (leads.length === 0) {
      return NextResponse.json(
        { error: 'No leads found' },
        { status: 404 }
      );
    }

    // Generate the email using AI
    const result = await generateCampaignEmail({
      leads: leads.map(lead => ({
        companyName: lead.companyName,
        industry: lead.industry || undefined,
        status: lead.status,
        source: lead.source,
      })),
      yourCompany,
      yourService,
      campaignGoal,
      tone,
      model: profile?.aiModel || DEFAULT_TEXT_MODEL,
      apiKey: userApiKey,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error('Error generating campaign email:', error);
    
    // Handle quota exceeded errors specifically
    if (error.message?.includes('quota') || error.message?.includes('RESOURCE_EXHAUSTED')) {
      return NextResponse.json(
        { error: 'AI service quota exceeded. Please try again later or upgrade your plan.' },
        { status: 429 }
      );
    }
    
    return NextResponse.json(
      { error: error.message || 'Failed to generate email' },
      { status: 500 }
    );
  }
}
