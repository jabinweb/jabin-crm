import { NextRequest, NextResponse } from 'next/server';
import { unsubscribeService } from '@/lib/crm/unsubscribe-service';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const params = await context.params;
    const email = unsubscribeService.decodeToken(params.token);
    const isUnsubscribed = await unsubscribeService.isUnsubscribed(email);

    return NextResponse.json({ email, isUnsubscribed });
  } catch (error: any) {
    console.error('Error checking unsubscribe status:', error);
    return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  const params = await context.params;
  let email: string;
  try {
    email = unsubscribeService.decodeToken(params.token);
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const reason = typeof body?.reason === 'string' ? body.reason.slice(0, 1000) : undefined;

    await unsubscribeService.unsubscribe(email, {
      reason,
      source: 'LINK_CLICK',
    });

    return NextResponse.json({ 
      success: true, 
      message: 'You have been unsubscribed successfully' 
    });
  } catch (error: any) {
    console.error('Error processing unsubscribe:', error);
    return NextResponse.json({ error: 'Failed to unsubscribe' }, { status: 500 });
  }
}
