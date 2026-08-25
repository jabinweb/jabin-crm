import { prisma } from '@/lib/prisma';
import { notificationService } from '@/lib/crm/notification-service';
import { sendEmail, createEmailHTML } from '@/lib/email/nodemailer';

export async function notifyStaffQuotationDecision(params: {
  quotationId: string;
  decision: 'ACCEPTED' | 'REJECTED';
  reason?: string;
}) {
  const quotation = await prisma.quotation.findUnique({
    where: { id: params.quotationId },
    select: {
      id: true,
      title: true,
      quotationNumber: true,
      customerName: true,
      userId: true,
      customer: { select: { companyId: true, organizationName: true } },
    },
  });

  if (!quotation) return;

  const companyId = quotation.customer?.companyId;
  const staffIds = new Set<string>();
  if (quotation.userId) staffIds.add(quotation.userId);

  if (companyId) {
    const admins = await prisma.user.findMany({
      where: {
        role: { in: ['ADMIN', 'SUPER_ADMIN', 'SALES', 'SUPPORT_MANAGER'] },
        OR: [{ companyId }, { primaryCompanyId: companyId }],
      },
      select: { id: true, email: true, name: true },
      take: 10,
    });
    for (const admin of admins) {
      staffIds.add(admin.id);
    }
  }

  const label = params.decision === 'ACCEPTED' ? 'accepted' : 'rejected';
  const title = `Quotation ${label}`;
  const body = `${quotation.customerName || quotation.customer?.organizationName || 'A client'} ${label} quote ${quotation.quotationNumber}: "${quotation.title}"${
    params.reason ? ` — ${params.reason}` : ''
  }`;

  await Promise.all(
    Array.from(staffIds).map((userId) =>
      notificationService
        .create({
          type: 'TICKET_UPDATED',
          title,
          body,
          userId,
          metadata: {
            quotationId: quotation.id,
            companyId,
            decision: params.decision,
          },
        })
        .catch(() => undefined)
    )
  );

  const creator = quotation.userId
    ? await prisma.user.findUnique({
        where: { id: quotation.userId },
        select: { email: true, name: true },
      })
    : null;

  if (creator?.email) {
    const baseUrl =
      process.env.NEXTAUTH_URL ??
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

    void sendEmail({
      to: creator.email,
      subject: `[Opslane] Quotation ${label}: ${quotation.quotationNumber}`,
      html: createEmailHTML(
        `Hello ${creator.name ?? 'there'},\n\n${body}\n\nView in dashboard: ${baseUrl}/workspace`
      ),
    }).catch((err) => console.error('[notifyStaffQuotationDecision.email]', err));
  }
}
