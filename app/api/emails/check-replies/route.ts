import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

/** IMAP can be slow; keep under Vercel serverless limits. */
export const maxDuration = 60;
export const runtime = 'nodejs';

const CHECK_TIMEOUT_MS = 45_000;

// Dynamically import the IMAP checker to avoid build errors if dependencies are missing
async function loadImapChecker() {
  try {
    const { getImapReplyChecker } = await import('@/lib/email/imap-reply-checker');
    return getImapReplyChecker;
  } catch (error) {
    console.error('[IMAP] Failed to load IMAP checker:', error);
    return null;
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('IMAP check timed out')), ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Load IMAP checker dynamically
    const getImapReplyChecker = await loadImapChecker();
    
    if (!getImapReplyChecker) {
      return NextResponse.json(
        {
          error: 'IMAP dependencies not available',
          message: 'IMAP packages are not installed. Install with: npm install imap mailparser',
        },
        { status: 503 }
      );
    }

    // Get checker with user's IMAP config or fallback to default
    const checker = await getImapReplyChecker(session.user.id);

    if (!checker.isConfigured()) {
      return NextResponse.json(
        {
          error: 'IMAP not configured',
          message: 'Please configure IMAP settings in Email Settings. Go to Dashboard > Emails > Email Settings to add your IMAP credentials.',
          hint: 'For Gmail: Enable IMAP in Gmail settings and use an App Password instead of your regular password.',
        },
        { status: 400 }
      );
    }

    // Optional: check only emails from the last N days
    const body = await req.json().catch(() => ({}));
    const daysBack = Math.min(Number(body.daysBack) || 7, 14);
    const since = new Date();
    since.setDate(since.getDate() - daysBack);

    console.log(`[IMAP] Checking for replies since ${since.toISOString()} for user ${session.user.id}`);

    let result: { processed: number; errors: string[] };
    try {
      result = await withTimeout(checker.checkForReplies(since), CHECK_TIMEOUT_MS);
    } catch (timeoutErr) {
      const message =
        timeoutErr instanceof Error ? timeoutErr.message : 'IMAP check timed out';
      console.warn(`[IMAP] ${message}`);
      return NextResponse.json(
        {
          success: false,
          processed: 0,
          timedOut: true,
          error: 'IMAP timeout',
          message:
            'Email reply check took too long and was stopped. Try again later, or use Email Settings to verify IMAP.',
        },
        { status: 504 }
      );
    }

    console.log(`[IMAP] Processed ${result.processed} replies, ${result.errors.length} errors`);
    
    if (result.errors.length > 0) {
      console.error('[IMAP] Errors:', result.errors);
    }

    return NextResponse.json({
      success: true,
      processed: result.processed,
      errors: result.errors,
      message: result.processed > 0 
        ? `Found ${result.processed} new ${result.processed === 1 ? 'reply' : 'replies'}!`
        : result.errors.length > 0
        ? `No replies found. ${result.errors.length} error(s) occurred.`
        : 'No new replies found in your inbox.',
    });
  } catch (error: any) {
    console.error('[IMAP] Error checking replies:', error);
    return NextResponse.json(
      {
        error: 'Failed to check replies',
        message: error.message,
        hint: 'Check your IMAP settings in Email Settings. Make sure your credentials are correct and IMAP is enabled for your email account.',
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    
    // Load IMAP checker dynamically
    const getImapReplyChecker = await loadImapChecker();
    
    if (!getImapReplyChecker) {
      return NextResponse.json({
        configured: false,
        error: 'IMAP dependencies not installed',
        instructions: {
          install: 'npm install imap mailparser @types/imap',
          note: 'IMAP packages are optional and only needed for email reply tracking',
        },
      });
    }

    const checker = await getImapReplyChecker(userId);

    return NextResponse.json({
      configured: checker.isConfigured(),
      instructions: {
        step1: 'Configure IMAP credentials in Settings or add to .env file',
        step2: 'For Gmail, enable IMAP and use an App Password',
        step3: 'POST to this endpoint to check for new replies',
        variables: {
          IMAP_HOST: 'imap.gmail.com',
          IMAP_PORT: '993',
          IMAP_USER: 'your-email@gmail.com',
          IMAP_PASSWORD: 'your-app-password',
          IMAP_TLS: 'true',
        },
        usage: 'POST /api/emails/check-replies with optional JSON body: { "daysBack": 7 }',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
