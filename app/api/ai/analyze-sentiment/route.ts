import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { analyzeSentiment, getAIClient } from '@/lib/ai/ai-service';
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
    const { replyContent, originalEmail, context } = body;

    if (!replyContent) {
      return NextResponse.json(
        { error: 'Reply content is required' },
        { status: 400 }
      );
    }

    const analysis = await analyzeSentiment({
      replyContent,
      originalEmail,
      context,
      model: profile?.aiModel || DEFAULT_TEXT_MODEL,
      apiKey: userApiKey,
    });

    return NextResponse.json({
      success: true,
      analysis,
    });

  } catch (error: any) {
    console.error('AI Sentiment Analysis Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to analyze sentiment' },
      { status: 500 }
    );
  }
}
