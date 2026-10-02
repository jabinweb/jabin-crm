import { NextRequest, NextResponse } from 'next/server';
import { getImapReplyChecker } from '@/lib/email/imap-reply-checker';

/**
 * Cron job to automatically check for email replies
 * 
 * For Vercel Cron, add this to vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/check-replies",
 *     "schedule": "0/10 * * * *"
 *   }]
 * }
 * 
 * Or call this from any external cron service
 */
export async function GET(req: NextRequest) {
  try {
    // Verify cron secret to prevent unauthorized access
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Note: Using default IMAP config since cron doesn't have user context
    const checker = await getImapReplyChecker();

    if (!checker.isConfigured()) {
      return NextResponse.json(
        {
          error: 'IMAP not configured',
          message: 'IMAP credentials not set in environment variables',
        },
        { status: 400 }
      );
    }

    // Check replies from the last 24 hours
    const since = new Date();
    since.setHours(since.getHours() - 24);

    console.log(`[CRON] Checking for replies since ${since.toISOString()}`);

    const result = await checker.checkForReplies(since);

    console.log(`[CRON] Processed ${result.processed} replies`);
    
    if (result.errors.length > 0) {
      console.error(`[CRON] Errors:`, result.errors);
    }

    return NextResponse.json({
      success: true,
      processed: result.processed,
      errors: result.errors,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[CRON] Error checking replies:', error);
    return NextResponse.json(
      {
        error: 'Failed to check replies',
        message: error.message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
