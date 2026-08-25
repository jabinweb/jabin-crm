/**
 * Seed active delivery data for the ScioLabs agency project.
 *
 * Usage:
 *   npx tsx scripts/seed-project-sciolabs-delivery.ts
 *   npx tsx scripts/seed-project-sciolabs-delivery.ts --force   # replace tasks/tickets
 */
import 'dotenv/config';
import { prisma } from '../lib/prisma';
import { computeProgressFromTasks } from '../lib/projects/task-board';

const PROJECT_ID = process.env.SEED_PROJECT_ID ?? 'cmt7toc9n0002twlaiolc8d76';
const FORCE = process.argv.includes('--force');

type TaskSeed = {
  title: string;
  description?: string;
  status: string;
  priority: string;
  sortOrder: number;
  daysUntilDue?: number;
};

const TASKS: TaskSeed[] = [
  // Done — discovery & design phase
  {
    title: 'Discovery workshop with Davis Abraham',
    description: 'Mapped ScioThrive, ScioCare, Sprints, TheoLingua, BeGin product lines and monorepo goals.',
    status: 'DONE',
    priority: 'HIGH',
    sortOrder: 0,
  },
  {
    title: 'Brand guidelines & shared UI kit',
    description: 'Teal/navy palette, Outfit + DM Sans typography, component tokens for all LMS tenants.',
    status: 'DONE',
    priority: 'HIGH',
    sortOrder: 1,
  },
  {
    title: 'ScioLabs hub homepage redesign',
    description: 'Services, stats, testimonials, and program cards on sciolabs.in.',
    status: 'DONE',
    priority: 'MEDIUM',
    sortOrder: 2,
  },
  {
    title: 'NextAuth v5 + Prisma spike',
    description: 'Validated auth flow across multi-tenant subdomains before monorepo cutover.',
    status: 'DONE',
    priority: 'MEDIUM',
    sortOrder: 3,
  },
  // In review
  {
    title: 'Subdomain routing (care · sprints · theo · begin)',
    description: 'Vercel wildcard + middleware tenant resolution per platform slug.',
    status: 'IN_REVIEW',
    priority: 'HIGH',
    sortOrder: 0,
    daysUntilDue: 3,
  },
  {
    title: 'CareBridge workbook + QR video content upload',
    description: 'INC-aligned CareBridge module — 80h program assets in CMS.',
    status: 'IN_REVIEW',
    priority: 'HIGH',
    sortOrder: 1,
    daysUntilDue: 5,
  },
  {
    title: 'Corporate site services CMS',
    description: 'ScioThrive, ScioLingua, ScioCare program pages editable from admin.',
    status: 'IN_REVIEW',
    priority: 'MEDIUM',
    sortOrder: 2,
    daysUntilDue: 7,
  },
  // In progress
  {
    title: 'Extract @sciolabs/ui shared package',
    description: 'Move shadcn primitives + theme to packages/ui for Turborepo consumers.',
    status: 'IN_PROGRESS',
    priority: 'URGENT',
    sortOrder: 0,
    daysUntilDue: 4,
  },
  {
    title: 'Unified Platform tenant model',
    description: 'Single Prisma schema with Platform, feature flags, and per-brand landing config.',
    status: 'IN_PROGRESS',
    priority: 'URGENT',
    sortOrder: 1,
    daysUntilDue: 6,
  },
  {
    title: 'Scio Sprints PWA + offline service worker',
    description: 'next-pwa for revision games; demo mode for school sales.',
    status: 'IN_PROGRESS',
    priority: 'HIGH',
    sortOrder: 2,
    daysUntilDue: 10,
  },
  {
    title: 'Razorpay subscription webhooks',
    description: 'Reconcile payments across Care, Sprints, and Guidance products.',
    status: 'IN_PROGRESS',
    priority: 'HIGH',
    sortOrder: 3,
    daysUntilDue: 8,
  },
  // To do
  {
    title: 'ScioCare batch enrollment + drip scheduler',
    description: 'College cohorts with scheduled content unlocks.',
    status: 'TODO',
    priority: 'HIGH',
    sortOrder: 0,
    daysUntilDue: 14,
  },
  {
    title: 'TheoLingua certificate on level completion',
    description: 'PDF certificate generation for CEFR levels A1–B2.',
    status: 'TODO',
    priority: 'MEDIUM',
    sortOrder: 1,
    daysUntilDue: 18,
  },
  {
    title: 'Hub job board + careers CMS',
    description: 'Seed roles: Full Stack, Curriculum Dev, Instructional Designer.',
    status: 'TODO',
    priority: 'MEDIUM',
    sortOrder: 2,
    daysUntilDue: 21,
  },
  {
    title: 'School admin bulk CSV import (Sprints)',
    description: 'Partner schools onboard students in one upload.',
    status: 'TODO',
    priority: 'MEDIUM',
    sortOrder: 3,
    daysUntilDue: 20,
  },
  // Backlog
  {
    title: 'BeGin tenant subdomain + pricing',
    description: 'begin.sciolabs.in interest-form → full LMS when ready.',
    status: 'BACKLOG',
    priority: 'LOW',
    sortOrder: 0,
  },
  {
    title: 'Scio Guidance psychometric → Zoom booking',
    description: 'Assessment results flow into counselor session scheduling.',
    status: 'BACKLOG',
    priority: 'MEDIUM',
    sortOrder: 1,
  },
  {
    title: 'Internal CRM ticket ingest from hub forms',
    description: 'Route contact, demo, and interest forms into support pipeline.',
    status: 'BACKLOG',
    priority: 'LOW',
    sortOrder: 2,
  },
  {
    title: 'Turbo CI/CD multi-app deploy',
    description: 'GitHub Actions matrix for all tenant apps on Vercel.',
    status: 'BACKLOG',
    priority: 'MEDIUM',
    sortOrder: 3,
  },
];

const TICKETS = [
  {
    subject: 'Update CareBridge pricing on ScioCare landing',
    description:
      'Davis requested revised CareBridge English pricing tiers before the March college outreach. Need copy + Razorpay plan IDs updated.',
    priority: 'HIGH' as const,
    status: 'IN_PROGRESS' as const,
    channel: 'EMAIL' as const,
  },
  {
    subject: 'Sprints leaderboard not refreshing after game session',
    description:
      'St. Mary\'s pilot school reports student scores stuck until hard refresh. Likely cache invalidation on topic progression API.',
    priority: 'MEDIUM' as const,
    status: 'OPEN' as const,
    channel: 'PORTAL' as const,
  },
  {
    subject: 'TheoLingua staff login — password reset emails delayed',
    description:
      'Seminary admin cannot reset passwords; Resend queue shows 429 rate limit during batch onboarding.',
    priority: 'HIGH' as const,
    status: 'ASSIGNED' as const,
    channel: 'WHATSAPP' as const,
  },
  {
    subject: 'Add ScioThrive corporate workshop page',
    description:
      'New landing section for educator upskilling programs — content draft attached in previous email thread.',
    priority: 'LOW' as const,
    status: 'OPEN' as const,
    channel: 'EMAIL' as const,
  },
];

const MILESTONE_UPDATES: Array<{ sortOrder: number; description: string; daysUntilDue: number }> = [
  { sortOrder: 2, description: 'Monorepo migration, shared packages, tenant routing, LMS features.', daysUntilDue: 21 },
  { sortOrder: 3, description: 'Cross-browser QA, college pilot feedback, payment flow testing.', daysUntilDue: 35 },
  { sortOrder: 4, description: 'Production cutover, DNS, analytics, client handoff to Davis.', daysUntilDue: 49 },
];

function addDays(base: Date, days: number) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function weekStartMonday(d = new Date()) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

async function main() {
  const project = await prisma.project.findUnique({
    where: { id: PROJECT_ID },
    include: {
      customer: true,
      company: true,
      pmUser: true,
      milestones: { orderBy: { sortOrder: 'asc' } },
      _count: { select: { tasks: true, tickets: true, timesheetEntries: true } },
    },
  });

  if (!project) {
    throw new Error(`Project not found: ${PROJECT_ID}`);
  }

  const pmUserId = project.pmUserId;
  if (!pmUserId) {
    throw new Error('Project has no PM user');
  }

  console.log(`Seeding delivery data → ${project.name} (${project.company.slug})`);

  const existingTasks = project._count.tasks;
  if (existingTasks > 0 && !FORCE) {
    console.log(`  Skipping tasks (${existingTasks} exist). Pass --force to replace.`);
  } else {
    if (FORCE && existingTasks > 0) {
      await prisma.projectTask.deleteMany({ where: { projectId: project.id } });
      console.log(`  Cleared ${existingTasks} existing tasks`);
    }

    const now = new Date();
    await prisma.projectTask.createMany({
      data: TASKS.map((t) => ({
        projectId: project.id,
        title: t.title,
        description: t.description ?? null,
        status: t.status,
        priority: t.priority,
        sortOrder: t.sortOrder,
        assigneeId: pmUserId,
        dueDate: t.daysUntilDue != null ? addDays(now, t.daysUntilDue) : null,
      })),
    });
    console.log(`  + ${TASKS.length} project tasks`);
  }

  // Project members
  await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId: project.id, userId: pmUserId } },
    create: { projectId: project.id, userId: pmUserId, role: 'PM' },
    update: { role: 'PM' },
  });
  console.log('  ~ PM added as project member');

  // Milestone descriptions + due dates
  const now = new Date();
  for (const m of MILESTONE_UPDATES) {
    const milestone = project.milestones.find((x) => x.sortOrder === m.sortOrder);
    if (!milestone) continue;
    await prisma.projectMilestone.update({
      where: { id: milestone.id },
      data: {
        description: m.description,
        dueDate: addDays(now, m.daysUntilDue),
      },
    });
  }
  console.log('  ~ Milestone due dates & descriptions');

  // Support tickets
  if (project._count.tickets === 0 || FORCE) {
    if (FORCE && project._count.tickets > 0) {
      await prisma.supportTicket.deleteMany({ where: { projectId: project.id } });
    }
    for (const t of TICKETS) {
      await prisma.supportTicket.create({
        data: {
          customerId: project.customerId!,
          projectId: project.id,
          subject: t.subject,
          description: t.description,
          priority: t.priority,
          status: t.status,
          channel: t.channel,
          assignedTechnicianId: pmUserId,
          firstRespondedAt: t.status !== 'OPEN' ? addDays(now, -1) : null,
        },
      });
    }
    console.log(`  + ${TICKETS.length} support tickets`);
  } else {
    console.log(`  Skipping tickets (${project._count.tickets} exist)`);
  }

  // Timesheet hours (last 2 weeks)
  const employee = await prisma.employee.findFirst({
    where: {
      OR: [{ userId: pmUserId }, { email: 'harshit@jabin.org' }],
      companyId: project.companyId,
    },
  });

  if (employee) {
    const weekStart = weekStartMonday(addDays(now, -7));
    const timesheet = await prisma.timesheet.upsert({
      where: {
        employeeId_weekStart: { employeeId: employee.id, weekStart },
      },
      create: {
        employeeId: employee.id,
        weekStart,
        status: 'DRAFT',
      },
      update: {},
    });

    const hoursByDay = [
      { offset: 0, hours: 6, note: 'Monorepo @sciolabs/ui extraction' },
      { offset: 1, hours: 5, note: 'Platform tenant model + Prisma' },
      { offset: 2, hours: 4, note: 'Scio Sprints PWA service worker' },
      { offset: 3, hours: 6, note: 'CareBridge content CMS + QA' },
      { offset: 4, hours: 3, note: 'Client sync with Davis — sprint planning' },
    ];

    if (FORCE) {
      await prisma.timesheetEntry.deleteMany({
        where: { timesheetId: timesheet.id, projectId: project.id },
      });
    }

    let added = 0;
    for (const row of hoursByDay) {
      const date = addDays(weekStart, row.offset);
      const exists = await prisma.timesheetEntry.findFirst({
        where: { timesheetId: timesheet.id, date, projectId: project.id },
      });
      if (exists) continue;
      await prisma.timesheetEntry.create({
        data: {
          timesheetId: timesheet.id,
          date,
          hours: row.hours,
          projectId: project.id,
          billable: true,
          note: row.note,
        },
      });
      added++;
    }
    console.log(`  + ${added} timesheet entries (${hoursByDay.reduce((s, r) => s + r.hours, 0)}h this week)`);
  } else {
    console.log('  Skipping timesheets (no employee profile for PM)');
  }

  // Retainer — platform maintenance
  const retainerName = 'ScioLabs platform maintenance & hosting';
  const existingRetainer = await prisma.clientRetainer.findFirst({
    where: { companyId: project.companyId, customerId: project.customerId!, name: retainerName },
  });
  if (!existingRetainer) {
    await prisma.clientRetainer.create({
      data: {
        companyId: project.companyId,
        customerId: project.customerId!,
        projectId: project.id,
        name: retainerName,
        description: 'Monthly hosting, security patches, and minor CMS updates across ScioLabs tenants.',
        amount: 45000,
        currency: 'INR',
        billingCycle: 'MONTHLY',
        status: 'ACTIVE',
        nextBillAt: addDays(now, 12),
      },
    });
    console.log('  + Client retainer (INR 45k/mo)');
  } else {
    console.log('  ~ Retainer already exists');
  }

  // Progress from tasks
  const tasks = await prisma.projectTask.findMany({
    where: { projectId: project.id },
    select: { status: true },
  });
  const progress = computeProgressFromTasks(tasks);
  await prisma.project.update({
    where: { id: project.id },
    data: { progress },
  });

  console.log(`\nDone. Project progress: ${progress}%`);
  console.log(
    `Open: http://localhost:3000/${project.company.slug}/dashboard/projects/${project.id}`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
