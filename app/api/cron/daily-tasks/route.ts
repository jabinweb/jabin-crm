import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { slaService } from '@/lib/crm/sla-service';
import { sequenceService } from '@/lib/crm/sequence-service';
import { emailQueueService } from '@/lib/crm/email-queue-service';
import { invoiceService } from '@/lib/crm/invoice-service';

// Consolidates daily tasks for Vercel Hobby (1 cron/day).
// Prefer real services over stub "mark as sent" logic.
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const results = {
      sequences: { processed: 0, errors: 0, detail: null as unknown },
      queue: { sent: 0, errors: 0, detail: null as unknown },
      scores: { calculated: 0, errors: 0 },
      sla: { scanned: 0, escalated: 0, skippedRecentlyEscalated: 0, errors: 0 },
      contracts: { expired: 0, errors: 0 },
      invoices: { overdueMarked: 0, errors: 0 },
      usage: { reset: 0, errors: 0 },
      pmDue: { created: 0, skipped: 0, companiesEligible: 0, errors: 0 },
    };

    // Task 1: Process email sequences (real send path)
    try {
      const seqResult = await sequenceService.processDueSteps();
      results.sequences.detail = seqResult;
      results.sequences.processed =
        typeof seqResult === 'object' && seqResult && 'processed' in seqResult
          ? Number((seqResult as { processed?: number }).processed) || 0
          : 0;
    } catch (error) {
      console.error('Error processing sequences:', error);
      results.sequences.errors += 1;
    }

    // Task 2: Process email queue (real SMTP send)
    try {
      const queueResult = await emailQueueService.processQueue();
      results.queue.detail = queueResult;
      results.queue.sent =
        typeof queueResult === 'object' && queueResult && 'sent' in queueResult
          ? Number((queueResult as { sent?: number }).sent) || 0
          : 0;
    } catch (error) {
      console.error('Error processing email queue:', error);
      results.queue.errors += 1;
    }

    // Task 3: Calculate lead scores (bounded batch)
    try {
      const leads = await prisma.lead.findMany({
        take: 500,
        orderBy: { updatedAt: 'desc' },
        include: {
          deals: true,
          tasks: true,
          emailLogs: true,
          score: true,
        },
      });

      for (const lead of leads) {
        try {
          let score = 50;

          const emailsSent = lead.emailLogs.filter((e) => e.status === 'SENT').length;
          const emailsOpened = lead.emailLogs.filter((e) => e.openedAt !== null).length;
          const emailsClicked = lead.emailLogs.filter((e) => e.clickedAt !== null).length;

          if (emailsSent > 0) {
            const openRate = emailsOpened / emailsSent;
            const clickRate = emailsClicked / emailsSent;
            score += openRate * 20 + clickRate * 30;
          }

          const activeDeals = lead.deals.filter(
            (d) => !['CLOSED_LOST', 'CLOSED_WON'].includes(d.stage)
          ).length;
          score += activeDeals * 10;

          const completedTasks = lead.tasks.filter((t) => t.status === 'COMPLETED').length;
          score += completedTasks * 5;

          const finalScore = Math.min(Math.round(score), 100);

          if (lead.score) {
            await prisma.leadScore.update({
              where: { leadId: lead.id },
              data: {
                totalScore: finalScore,
                lastCalculatedAt: new Date(),
              },
            });
          } else {
            await prisma.leadScore.create({
              data: {
                leadId: lead.id,
                totalScore: finalScore,
                lastCalculatedAt: new Date(),
              },
            });
          }

          results.scores.calculated++;
        } catch (error) {
          console.error(`Error calculating score for lead ${lead.id}:`, error);
          results.scores.errors++;
        }
      }
    } catch (error) {
      console.error('Error calculating scores:', error);
    }

    // Task 4: SLA escalation sweep
    try {
      const slaResult = await slaService.runEscalationSweep();
      results.sla.scanned = slaResult.scanned;
      results.sla.escalated = slaResult.escalatedCount;
      results.sla.skippedRecentlyEscalated = slaResult.skippedRecentlyEscalated;
    } catch (error) {
      console.error('Error processing SLA escalation sweep:', error);
      results.sla.errors += 1;
    }

    // Task 5: Expire overdue AMC/CMC contracts
    try {
      const expired = await prisma.serviceContract.updateMany({
        where: {
          status: 'ACTIVE',
          endDate: { lt: new Date() },
        },
        data: { status: 'EXPIRED' },
      });
      results.contracts.expired = expired.count;
    } catch (error) {
      console.error('Error expiring service contracts:', error);
      results.contracts.errors += 1;
    }

    // Task 6: Mark overdue invoices
    try {
      const overdue = await invoiceService.markOverdueInvoices();
      results.invoices.overdueMarked =
        typeof overdue === 'object' && overdue && 'count' in overdue
          ? Number((overdue as { count?: number }).count) || 0
          : 0;
    } catch (error) {
      console.error('Error marking overdue invoices:', error);
      results.invoices.errors += 1;
    }

    // Task 7: Monthly usage allowance reset (≥30 days since lastResetAt)
    try {
      const { resetStaleMonthlyUsage } = await import('@/lib/subscription');
      const usageReset = await resetStaleMonthlyUsage();
      results.usage.reset = usageReset.reset;
    } catch (error) {
      console.error('Error resetting monthly usage:', error);
      results.usage.errors += 1;
    }

    // Task 8: Industry pack — PM due → create preventive maintenance tickets
    try {
      const { runPmDueTicketAutomation } = await import('@/lib/crm/pm-due-automation');
      const pm = await runPmDueTicketAutomation();
      results.pmDue.created = pm.created;
      results.pmDue.skipped = pm.skipped;
      results.pmDue.companiesEligible = pm.companiesEligible;
      results.pmDue.errors = pm.errors;
    } catch (error) {
      console.error('Error running PM due automation:', error);
      results.pmDue.errors += 1;
    }

    return NextResponse.json({
      success: true,
      message: 'Daily tasks completed',
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in daily cron job:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
