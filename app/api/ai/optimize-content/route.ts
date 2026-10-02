import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { optimizeEmailContent } from '@/lib/ai/ai-service';
import { prisma } from '@/lib/prisma';
import { DEFAULT_TEXT_MODEL } from '@/lib/ai/generate';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Fetch user profile for API key and model preference
    const profile = await prisma.userProfile.findUnique({
      where: { userId: session.user.id },
      select: { geminiApiKey: true, aiModel: true },
    });

    // Decrypt API key if user has one
    let userApiKey: string | undefined = undefined;
    if (profile?.geminiApiKey) {
      try {
        const { decrypt } = require('@/lib/encryption');
        userApiKey = decrypt(profile.geminiApiKey).trim();
      } catch (error) {
        console.error('Failed to decrypt API key:', error);
      }
    }

    const body = await request.json();
    const { content, companyName, goal, targetAudience } = body;

    if (!content || !companyName) {
      return NextResponse.json(
        { error: 'Content and company name are required' },
        { status: 400 }
      );
    }

    const optimization = await optimizeEmailContent({
      content,
      companyName,
      goal,
      targetAudience,
      model: profile?.aiModel || DEFAULT_TEXT_MODEL,
      apiKey: userApiKey,
    });

    return NextResponse.json({
      success: true,
      optimization,
    });

  } catch (error: any) {
    console.error('AI Content Optimization Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to optimize content' },
      { status: 500 }
    );
  }
}
