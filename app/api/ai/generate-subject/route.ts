import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { generateSubjectLines } from '@/lib/ai/ai-service';
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
    const { companyName, industry, productService, targetAudience, tone, count } = body;

    if (!companyName || !productService) {
      return NextResponse.json(
        { error: 'Company name and product/service are required' },
        { status: 400 }
      );
    }

    const variants = await generateSubjectLines({
      companyName,
      industry,
      productService,
      targetAudience,
      tone,
      count: count || 5,
      model: profile?.aiModel || DEFAULT_TEXT_MODEL,
      apiKey: userApiKey,
    });

    return NextResponse.json({
      success: true,
      variants,
    });

  } catch (error: any) {
    console.error('AI Subject Line Generation Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate subject lines' },
      { status: 500 }
    );
  }
}
