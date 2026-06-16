import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const planModules = {
  free: { LEADS: true, EMAIL_OUTREACH: true, TICKETS: true },
  starter: {
    LEADS: true,
    EMAIL_OUTREACH: true,
    TICKETS: true,
    SUPPORT_LIVE_CHAT: true,
    SUPPORT_KNOWLEDGE: true,
    DEALS: true,
    QUOTATIONS: true,
  },
  professional: {
    LEADS: true,
    DEALS: true,
    QUOTATIONS: true,
    INVOICES: true,
    TICKETS: true,
    SUPPORT_INBOX: true,
    SUPPORT_SLA: true,
    SUPPORT_LIVE_CHAT: true,
    SUPPORT_KNOWLEDGE: true,
    SUPPORT_CANNED: true,
    SUPPORT_GROUPS: true,
    TICKET_ADVANCED: true,
    SERVICE_REPORTS: true,
    SERVICE_CASH: true,
    SERVICE_EXPENSES: true,
    SERVICE_GPS: true,
    WHATSAPP: true,
    EMAIL_OUTREACH: true,
  },
  enterprise: {
    LEADS: true,
    DEALS: true,
    QUOTATIONS: true,
    INVOICES: true,
    TICKETS: true,
    SUPPORT_INBOX: true,
    SUPPORT_SLA: true,
    SUPPORT_LIVE_CHAT: true,
    SUPPORT_KNOWLEDGE: true,
    SUPPORT_CANNED: true,
    SUPPORT_GROUPS: true,
    TICKET_ADVANCED: true,
    SERVICE_REPORTS: true,
    SERVICE_CASH: true,
    SERVICE_EXPENSES: true,
    SERVICE_GPS: true,
    WHATSAPP: true,
    EMAIL_OUTREACH: true,
  },
};

for (const [name, modules] of Object.entries(planModules)) {
  const result = await prisma.plan.updateMany({
    where: { name },
    data: { modules },
  });
  console.log(`Updated ${name}: ${result.count} row(s)`);
}

await prisma.$disconnect();
