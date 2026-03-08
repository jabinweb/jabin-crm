import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { slaService } from '@/lib/crm/sla-service';

// This cron job consolidates all daily tasks for Vercel Hobby plan
// Runs once per day at 2 AM UTC
export async function GET(request: NextRequest) {
  try {
    // Verify the request is from Vercel Cron
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const results = {
      sequences: { processed: 0, errors: 0 },
      queue: { processed: 0, errors: 0 },
      scores: { calculated: 0, errors: 0 },
      sla: { scanned: 0, escalated: 0, skippedRecentlyEscalated: 0, errors: 0 },
    };

    // Task 1: Process Email Sequences
    try {
      const activeSequences = await prisma.sequenceEnrollment.findMany({
        where: {
          status: 'ACTIVE',
          currentStep: { gte: 0 },
          nextStepDue: { lte: new Date() },
        },
        include: {
          sequence: {
            include: {
              steps: {
                orderBy: { stepNumber: 'asc' },
              },
            },
          },
          lead: true,
        },
      });

      for (const enrollment of activeSequences) {
        try {
          const currentStep = enrollment.sequence.steps[enrollment.currentStep];
          
          if (!currentStep) {
            // Sequence completed
            await prisma.sequenceEnrollment.update({
              where: { id: enrollment.id },
              data: {
                status: 'COMPLETED',
                completedAt: new Date(),
              },
            });
            continue;
          }

          // Check if it's time to send the next email
          if (enrollment.nextStepDue && enrollment.nextStepDue <= new Date()) {
            // Calculate next step delay
            const nextStepIndex = enrollment.currentStep + 1;
            const nextStep = enrollment.sequence.steps[nextStepIndex];
            const delayMs = nextStep 
              ? (nextStep.delayDays * 24 * 60 * 60 * 1000) + (nextStep.delayHours * 60 * 60 * 1000)
              : 0;

            // Process the step (send email, create task, etc.)
            await prisma.sequenceEnrollment.update({
              where: { id: enrollment.id },
              data: {
                currentStep: enrollment.currentStep + 1,
                lastStepSentAt: new Date(),
                nextStepDue: nextStep ? new Date(Date.now() + delayMs) : null,
              },
            });

            results.sequences.processed++;
          }
        } catch (error) {
          console.error(`Error processing sequence enrollment ${enrollment.id}:`, error);
          results.sequences.errors++;
        }
      }
    } catch (error) {
      console.error('Error processing sequences:', error);
    }

    // Task 2: Process Email Queue
    try {
      const queuedEmails = await prisma.emailLog.findMany({
        where: {
          status: 'PENDING',
        },
        take: 50, // Process 50 emails per run
        orderBy: {
          createdAt: 'asc',
        },
      });

      for (const email of queuedEmails) {
        try {
          // Email sending would happen here
          // For now, just mark as sent
          await prisma.emailLog.update({
            where: { id: email.id },
            data: {
              status: 'SENT',
              sentAt: new Date(),
            },
          });

          results.queue.processed++;
        } catch (error) {
          console.error(`Error processing email ${email.id}:`, error);
          await prisma.emailLog.update({
            where: { id: email.id },
            data: {
              status: 'FAILED',
              errorMessage: error instanceof Error ? error.message : 'Unknown error',
            },
          });
          results.queue.errors++;
        }
      }
    } catch (error) {
      console.error('Error processing email queue:', error);
    }

    // Task 3: Calculate Lead Scores
    try {
      const leads = await prisma.lead.findMany({
        include: {
          deals: true,
          tasks: true,
          emailLogs: true,
          score: true,
        },
      });

      for (const lead of leads) {
        try {
          let score = 50; // Base score

          // Email engagement
          const emailsSent = lead.emailLogs.filter(e => e.status === 'SENT').length;
          const emailsOpened = lead.emailLogs.filter(e => e.openedAt !== null).length;
          const emailsClicked = lead.emailLogs.filter(e => e.clickedAt !== null).length;

          if (emailsSent > 0) {
            const openRate = emailsOpened / emailsSent;
            const clickRate = emailsClicked / emailsSent;
            score += openRate * 20 + clickRate * 30;
          }

          // Deal activity
          const activeDeals = lead.deals.filter(d => 
            !['CLOSED_LOST', 'CLOSED_WON'].includes(d.stage)
          ).length;
          score += activeDeals * 10;

          // Task completion
          const completedTasks = lead.tasks.filter(t => t.status === 'COMPLETED').length;
          score += completedTasks * 5;

          // Cap at 100
          const finalScore = Math.min(Math.round(score), 100);

          // Update or create score
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
