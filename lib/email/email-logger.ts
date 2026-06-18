import { prisma } from '@/lib/prisma';
import { logError, logInfo, logWarning } from '@/lib/logger';

export interface EmailLogData {
  userId: string;
  leadId?: string;
  campaignId?: string;
  to: string;
  subject: string;
  body?: string;
  status?: 'PENDING' | 'SENT' | 'DELIVERED' | 'OPENED' | 'CLICKED' | 'BOUNCED' | 'FAILED' | 'REPLIED';
  metadata?: any;
}

/**
 * Create a new email log entry
 */
export async function createEmailLog(data: EmailLogData) {
  try {
    const log = await prisma.emailLog.create({
      data: {
        userId: data.userId,
        leadId: data.leadId,
        campaignId: data.campaignId,
        to: data.to,
        subject: data.subject,
        body: data.body,
        status: data.status || 'PENDING',
        metadata: data.metadata,
      },
    });
    
    return log;
  } catch (error) {
    logError(error, { context: 'Error creating email log' });
    throw error;
  }
}

/**
 * Update email log status
 */
export async function updateEmailLogStatus(
  logId: string,
  status: 'SENT' | 'DELIVERED' | 'OPENED' | 'CLICKED' | 'BOUNCED' | 'FAILED' | 'REPLIED',
  errorMessage?: string
) {
  try {
    const updates: any = { status };
    
    // Set timestamp based on status
    if (status === 'SENT') {
      updates.sentAt = new Date();
    } else if (status === 'DELIVERED') {
      updates.deliveredAt = new Date();
    } else if (status === 'OPENED') {
      updates.openedAt = new Date();
    } else if (status === 'CLICKED') {
      updates.clickedAt = new Date();
    } else if (status === 'BOUNCED') {
      updates.bouncedAt = new Date();
    } else if (status === 'REPLIED') {
      updates.repliedAt = new Date();
    }
    
    if (errorMessage) {
      updates.errorMessage = errorMessage;
    }
    
    const log = await prisma.emailLog.update({
      where: { id: logId },
      data: updates,
    });
    
    return log;
  } catch (error) {
    logError(error, { context: 'Error updating email log' });
    throw error;
  }
}

/**
 * Track email open event
 */
export async function trackEmailOpen(logId: string) {
  try {
    // Only update if not already opened
    const log = await prisma.emailLog.findUnique({
      where: { id: logId },
      select: { openedAt: true },
    });
    
    if (!log?.openedAt) {
      return updateEmailLogStatus(logId, 'OPENED');
    }
    
    return log;
  } catch (error) {
    logError(error, { context: 'Error tracking email open' });
    throw error;
  }
}

/**
 * Track email click event
 */
export async function trackEmailClick(logId: string) {
  try {
    // Only update if not already clicked
    const log = await prisma.emailLog.findUnique({
      where: { id: logId },
      select: { clickedAt: true },
    });
    
    if (!log?.clickedAt) {
      return updateEmailLogStatus(logId, 'CLICKED');
    }
    
    return log;
  } catch (error) {
    logError(error, { context: 'Error tracking email click' });
    throw error;
  }
}

/**
 * Track email reply
 */
export async function trackEmailReply(
  logId: string,
  replySubject: string,
  replyBody: string,
  replyDate?: Date
) {
  try {
    // Get the current log to check if we already have a reply
    const existingLog = await prisma.emailLog.findUnique({
      where: { id: logId },
      select: { repliedAt: true, replyBody: true },
    });

    // If we already have a reply, check if the new one is different/newer
    if (existingLog?.repliedAt) {
      const newReplyDate = replyDate || new Date();
      
      // Only update if:
      // 1. The new reply date is newer, OR
      // 2. The reply content is different (indicating a new reply in the thread)
      const isNewer = newReplyDate > existingLog.repliedAt;
      const isDifferent = existingLog.replyBody !== replyBody;
      
      if (!isNewer && !isDifferent) {
        logInfo('Reply already tracked, skipping duplicate', { logId });
        return existingLog as any;
      }
      
      logInfo('Updating reply', { logId, isNewer, isDifferent });
    }

    const log = await prisma.emailLog.update({
      where: { id: logId },
      data: {
        status: 'REPLIED',
        repliedAt: replyDate || new Date(),
        replySubject,
        replyBody,
      },
    });
    
    return log;
  } catch (error) {
    logError(error, { context: 'Error tracking email reply' });
    throw error;
  }
}

/**
 * Find email log by In-Reply-To header for PRECISE reply matching
 * This is the correct way to match email replies using email threading standards
 */
export async function findEmailLogForReply(
  replyFromEmail: string,
  replySubject: string,
  userId?: string,
  inReplyTo?: string // The In-Reply-To header from the reply email
) {
  try {
    // PRIORITY 1: If we have In-Reply-To header, use it for EXACT matching
    // This is the most reliable method - it matches the Message-ID we sent
    if (inReplyTo) {
      logInfo('Using In-Reply-To header for exact matching', { inReplyTo });
      
      const where: any = {
        messageId: inReplyTo, // Match our sent email's Message-ID with reply's In-Reply-To
        to: replyFromEmail, // Verify it's the right recipient
      };
      
      if (userId) {
        where.userId = userId;
      }
      
      const exactMatch = await prisma.emailLog.findFirst({
        where,
        orderBy: { sentAt: 'desc' },
      });
      
      if (exactMatch) {
        logInfo('Exact match found via Message-ID', { subject: exactMatch.subject });
        return exactMatch;
      }
      
      logInfo('No email found with Message-ID', { messageId: inReplyTo });
    }
    
    // PRIORITY 2: Fallback to subject matching only if no In-Reply-To header
    // This is less reliable but handles edge cases where headers are missing
    logInfo('Falling back to subject matching', { replySubject });
    
    const where: any = {
      to: replyFromEmail,
      status: { in: ['SENT', 'DELIVERED', 'OPENED', 'CLICKED', 'REPLIED'] },
    };
    
    if (userId) {
      where.userId = userId;
    }
    
    // Look for emails sent in the last 30 days
    where.sentAt = {
      gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    };
    
    const logs = await prisma.emailLog.findMany({
      where,
      orderBy: { sentAt: 'desc' },
      take: 10,
    });

    if (logs.length === 0) {
      logInfo('No sent emails found to recipient', { email: replyFromEmail });
      return null;
    }
    
    // Try to match by subject (removing Re:, Fwd:, etc.)
    const cleanSubject = replySubject
      .replace(/^(re:|fwd?:|fw:)\s*/i, '')
      .trim()
      .toLowerCase();
    
    // EXACT subject match
    const exactMatch = logs.find((log) => {
      const logSubject = log.subject.toLowerCase().trim();
      return cleanSubject === logSubject;
    });
    
    if (exactMatch) {
      logInfo('Exact subject match found', { subject: exactMatch.subject });
      return exactMatch;
    }
    
    // High similarity match (90%+)
    const matchedLog = logs.find((log) => {
      const logSubject = log.subject.toLowerCase().trim();
      
      const cleanWords = cleanSubject.split(/\s+/).filter(w => w.length > 2 && !['the', 'and', 'for', 'with'].includes(w));
      const logWords = logSubject.split(/\s+/).filter(w => w.length > 2 && !['the', 'and', 'for', 'with'].includes(w));
      
      if (cleanWords.length === 0 || logWords.length === 0) return false;
      
      const matchingWords = cleanWords.filter(word => logWords.some(logWord => 
        logWord.includes(word) || word.includes(logWord)
      ));
      
      const similarity = matchingWords.length / Math.min(cleanWords.length, logWords.length);
      
      if (similarity >= 0.9) {
        logInfo('High-similarity match found', { similarity: (similarity * 100).toFixed(0) + '%', subject: logSubject });
        return true;
      }
      
      return false;
    });
    
    if (matchedLog) {
      return matchedLog;
    }
    
    // NO MATCH - Don't force it to any email
    logWarning('No good subject match found for reply', { 
      replySubject, 
      candidates: logs.map(l => l.subject) 
    });
    
    return null; // Don't force wrong matches
  } catch (error) {
    logError(error, { context: 'Error finding email log for reply' });
    throw error;
  }
}

/**
 * Get email logs for a user
 */
export async function getUserEmailLogs(
  userId: string,
  options?: {
    skip?: number;
    take?: number;
    status?: string;
    search?: string;
  }
) {
  const where: any = { userId };
  
  if (options?.status) {
    where.status = options.status;
  }
  
  if (options?.search) {
    where.OR = [
      { to: { contains: options.search, mode: 'insensitive' } },
      { subject: { contains: options.search, mode: 'insensitive' } },
    ];
  }
  
  try {
    const [logs, total] = await Promise.all([
      prisma.emailLog.findMany({
        where,
        orderBy: { sentAt: 'desc' },
        skip: options?.skip || 0,
        take: options?.take || 20,
        include: {
          lead: {
            select: {
              companyName: true,
              contactName: true,
            },
          },
          campaign: {
            select: {
              name: true,
            },
          },
        },
      }),
      prisma.emailLog.count({ where }),
    ]);
    
    return { logs, total };
  } catch (error) {
    logError(error, { context: 'Error fetching email logs' });
    throw error;
  }
}
