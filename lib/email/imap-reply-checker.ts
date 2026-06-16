// Dynamic imports to avoid build issues
let Imap: any;
let simpleParser: any;

async function loadImapDependencies() {
  if (!Imap) {
    try {
      // @ts-ignore - imap is a CommonJS module
      const imapModule = await import('imap');
      Imap = imapModule.default || imapModule;
    } catch (error) {
      console.error('Failed to load imap package:', error);
      throw new Error('IMAP package not available');
    }
  }
  
  if (!simpleParser) {
    try {
      // @ts-ignore - mailparser types may not be perfect
      const mailparserModule = await import('mailparser');
      simpleParser = mailparserModule.simpleParser;
    } catch (error) {
      console.error('Failed to load mailparser package:', error);
      throw new Error('Mailparser package not available');
    }
  }
}

import { findEmailLogForReply, trackEmailReply } from '@/lib/email-logger';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';
import { logInfo, logError, logWarning } from '@/lib/logger';

interface ImapConfig {
  user: string;
  password: string;
  host: string;
  port: number;
  tls: boolean;
}

interface ParsedEmail {
  from: string;
  to: string;
  subject: string;
  text?: string;
  html?: string;
  messageId?: string;
  inReplyTo?: string;
  date?: Date;
}

export class ImapReplyChecker {
  private config: ImapConfig;
  private userId?: string;

  constructor(customConfig?: ImapConfig, userId?: string) {
    if (customConfig) {
      this.config = customConfig;
      this.userId = userId;
    } else {
      // Fallback to environment variables
      this.config = {
        user: process.env.IMAP_USER || '',
        password: process.env.IMAP_PASSWORD || '',
        host: process.env.IMAP_HOST || 'imap.gmail.com',
        port: parseInt(process.env.IMAP_PORT || '993'),
        tls: process.env.IMAP_TLS !== 'false',
      };
    }
  }

  isConfigured(): boolean {
    return !!(this.config.user && this.config.password);
  }

  async checkForReplies(since?: Date): Promise<{ processed: number; errors: string[] }> {
    if (!this.isConfigured()) {
      throw new Error('IMAP not configured. Set IMAP_USER and IMAP_PASSWORD in .env');
    }

    // Load dependencies dynamically
    await loadImapDependencies();

    return new Promise((resolve, reject) => {
      const imap = new Imap({
        user: this.config.user,
        password: this.config.password,
        host: this.config.host,
        port: this.config.port,
        tls: this.config.tls,
        tlsOptions: { rejectUnauthorized: false },
        authTimeout: 30000, // 30 seconds timeout
        connTimeout: 30000, // 30 seconds connection timeout
      });

      let processed = 0;
      const errors: string[] = [];
      let hasResolved = false;

      // Set a safety timeout
      const safetyTimeout = setTimeout(() => {
        if (!hasResolved) {
          hasResolved = true;
          errors.push('Connection timeout - check your IMAP settings');
          try {
            imap.end();
          } catch (e) {
            // Ignore cleanup errors
          }
          resolve({ processed, errors });
        }
      }, 45000); // 45 seconds total timeout

      imap.once('ready', () => {
        imap.openBox('INBOX', false, async (err: any, box: any) => {
          if (err) {
            errors.push(`Failed to open inbox: ${err.message}`);
            imap.end();
            return;
          }

          // Search for emails since a specific date, or last 7 days if not specified
          const searchDate = since || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          const searchCriteria = [['SINCE', searchDate]];

          imap.search(searchCriteria, (err: any, results: any) => {
            if (err) {
              errors.push(`Search failed: ${err.message}`);
              imap.end();
              return;
            }

            if (!results || results.length === 0) {
              logInfo('No new emails found');
              imap.end();
              resolve({ processed: 0, errors });
              return;
            }

            const fetch = imap.fetch(results, { bodies: '' });

            fetch.on('message', (msg: any) => {
              msg.on('body', (stream: any) => {
                simpleParser(stream, async (err: any, parsed: any) => {
                  if (err) {
                    errors.push(`Parse error: ${err.message}`);
                    return;
                  }

                  try {
                    await this.processEmail(parsed);
                    processed++;
                  } catch (error: any) {
                    errors.push(`Process error: ${error.message}`);
                  }
                });
              });
            });

            fetch.once('error', (err: any) => {
              errors.push(`Fetch error: ${err.message}`);
            });

            fetch.once('end', () => {
              logInfo('Done fetching all messages');
              clearTimeout(safetyTimeout);
              imap.end();
            });
          });
        });
      });

      imap.once('error', (err: any) => {
        clearTimeout(safetyTimeout);
        if (!hasResolved) {
          hasResolved = true;
          const errorMsg = err.message || 'Unknown IMAP error';
          logError(new Error('IMAP connection error'), { error: errorMsg });
          
          // Provide helpful error messages
          if (errorMsg.includes('Timed out') || errorMsg.includes('timeout')) {
            errors.push('Connection timeout. Check: 1) IMAP host/port are correct, 2) Network allows IMAP connections, 3) Credentials are valid');
          } else if (errorMsg.includes('authentication') || errorMsg.includes('login')) {
            errors.push('Authentication failed. For Gmail, use an App Password (not your regular password). Enable IMAP in Gmail settings.');
          } else if (errorMsg.includes('certificate') || errorMsg.includes('SSL') || errorMsg.includes('TLS')) {
            errors.push('SSL/TLS error. Try: 1) Check IMAP port (usually 993 for SSL), 2) Verify host is correct');
          } else {
            errors.push(`Connection error: ${errorMsg}`);
          }
          
          resolve({ processed, errors });
        }
      });

      imap.once('end', () => {
        clearTimeout(safetyTimeout);
        if (!hasResolved) {
          hasResolved = true;
          resolve({ processed, errors });
        }
      });

      imap.connect();
    });
  }

  private async processEmail(parsed: any): Promise<void> {
    const from = parsed.from?.value?.[0]?.address || '';
    const to = parsed.to?.value?.[0]?.address || '';
    const subject = parsed.subject || '';
    const text = parsed.text || '';
    const html = parsed.html || '';
    const messageId = parsed.messageId || '';
    const inReplyTo = parsed.inReplyTo || '';
    const date = parsed.date || new Date();

    // Skip emails that are not replies
    // Check for reply indicators: "Re:" prefix or inReplyTo header
    const isReply = subject.toLowerCase().startsWith('re:') || 
                    subject.toLowerCase().includes('re: ') ||
                    inReplyTo;

    if (!isReply) {
      // Silently skip non-reply emails (notifications, newsletters, etc.)
      return;
    }

    logInfo('Processing reply', { from, subject, date, inReplyTo: inReplyTo || '(none)' });

    // Try to find the original email this is replying to
    // Pass In-Reply-To header for EXACT matching via Message-ID
    const originalLog = await findEmailLogForReply(from, subject, this.userId, inReplyTo);

    if (!originalLog) {
      logWarning('No matching original email found for reply - will be skipped', { from });
      return;
    }

    logInfo('Found original email', { emailId: originalLog.id });

    // Track the reply with the actual email date
    await trackEmailReply(originalLog.id, subject, text || html, date);

    // Create lead activity (use upsert to avoid duplicates based on messageId)
    if (originalLog.leadId) {
      // Check if this reply already exists by messageId
      const existingActivity = await prisma.leadActivity.findFirst({
        where: {
          leadId: originalLog.leadId,
          activityType: 'EMAIL_REPLIED',
          metadata: {
            path: ['messageId'],
            equals: messageId,
          },
        },
      });

      if (!existingActivity) {
        await prisma.leadActivity.create({
          data: {
            leadId: originalLog.leadId,
            activityType: 'EMAIL_REPLIED',
            description: `Received email reply: ${subject}`,
            metadata: {
              from,
              subject,
              body: text || html, // Store FULL reply body
              preview: text?.substring(0, 200) || html?.substring(0, 200), // Keep preview for list view
              messageId,
              inReplyTo,
            },
            userId: originalLog.userId,
          },
        });
      }

      // Update lead status if it's still NEW or CONTACTED
      const lead = await prisma.lead.findUnique({
        where: { id: originalLog.leadId },
        select: { status: true },
      });

      if (lead?.status === 'NEW' || lead?.status === 'CONTACTED') {
        await prisma.lead.update({
          where: { id: originalLog.leadId },
          data: {
            status: 'RESPONDED',
            lastContactedAt: new Date(),
          },
        });
      }

      logInfo('Updated lead activity and status');
    }

    // If part of a campaign, update campaign stats
    if (originalLog.campaignId) {
      await prisma.emailCampaign.update({
        where: { id: originalLog.campaignId },
        data: {
          replyCount: { increment: 1 },
        },
      });

      logInfo('Updated campaign reply count');
    }
  }
}

/**
 * Get user's IMAP configuration from database
 */
export async function getUserImapConfig(userId: string): Promise<ImapConfig | null> {
  const profile = await prisma.userProfile.findUnique({
    where: { userId },
    select: {
      imapHost: true,
      imapPort: true,
      imapSecure: true,
      imapUser: true,
      imapPassword: true,
    },
  });

  if (!profile?.imapHost || !profile?.imapUser || !profile?.imapPassword) {
    return null;
  }

  return {
    host: profile.imapHost,
    port: profile.imapPort || 993,
    tls: profile.imapSecure !== false,
    user: profile.imapUser,
    password: decrypt(profile.imapPassword),
  };
}

/**
 * Get IMAP reply checker for a specific user or use default config
 */
export async function getImapReplyChecker(userId?: string): Promise<ImapReplyChecker> {
  if (userId) {
    const userConfig = await getUserImapConfig(userId);
    if (userConfig) {
      logInfo('Using user custom IMAP config', { host: userConfig.host });
      return new ImapReplyChecker(userConfig, userId);
    }
  }

  // Fallback to environment-based config
  logInfo('Using default IMAP from environment');
  return new ImapReplyChecker();
}

