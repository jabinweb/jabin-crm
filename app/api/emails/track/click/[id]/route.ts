import { NextRequest, NextResponse } from 'next/server';
import { trackEmailClick } from '@/lib/email-logger';

/** Public click tracker — no auth or plan gate (recipients follow this redirect URL). */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');
    
    // Track the email click
    await trackEmailClick(id);
    
    // Redirect to the target URL
    if (url) {
      return NextResponse.redirect(url);
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error tracking email click:', error);
    
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');
    
    // Still redirect even on error
    if (url) {
      return NextResponse.redirect(url);
    }
    
    return NextResponse.json({ error: 'Failed to track click' }, { status: 500 });
  }
}
