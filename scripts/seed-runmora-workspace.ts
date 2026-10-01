/**
 * Seed the Runmora workspace with its "Mobile App MVP" project:
 * task statuses, milestones, labelled tasks and the project brief as docs.
 *
 * Usage:
 *   npx tsx scripts/seed-runmora-workspace.ts
 *   npx tsx scripts/seed-runmora-workspace.ts --force   # rebuild the project from scratch
 *
 * Team:
 *   RUNMORA_LEAD_EMAIL    existing user who leads the project (default: first ADMIN named Harshit)
 *   RUNMORA_RACHEL_EMAIL  optional — creates/links Rachel (product)
 *   RUNMORA_JASON_EMAIL   optional — creates/links Jason (business)
 * Rachel and Jason are only added when a real email is given; invite them later from
 * Admin → Users otherwise.
 */
import 'dotenv/config';
import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { buildInitialCompanySettings } from '../lib/workspace-config';
import { completedOnboardingState } from '../lib/onboarding/company-onboarding';

const FORCE = process.argv.includes('--force');

const COMPANY = { name: 'Runmora', slug: 'runmora' };
const PROJECT_NAME = 'Runmora – Mobile App MVP';

const TASK_STATUSES = [
  { id: 'BACKLOG', label: 'Backlog', color: 'bg-slate-400' },
  { id: 'TODO', label: 'To Do', color: 'bg-sky-500' },
  { id: 'IN_PROGRESS', label: 'In Progress', color: 'bg-amber-500' },
  { id: 'IN_REVIEW', label: 'In Review', color: 'bg-violet-500' },
  { id: 'TESTING', label: 'Testing', color: 'bg-cyan-500' },
  { id: 'DONE', label: 'Done', color: 'bg-emerald-500', isDone: true },
].map((status, order) => ({ ...status, order }));

/** Development timeline from the brief; weeks are cumulative from project start. */
const PHASES = [
  { title: 'Foundation', weeks: 4, description: 'Project setup, architecture, authentication, and core infrastructure.' },
  { title: 'Core experience', weeks: 4, description: 'Main app experience, mood check-ins, breathwork, and mindset content.' },
  { title: 'Confidence & progress', weeks: 3, description: 'Confidence Bank and progress tracking.' },
  { title: 'Premium platform', weeks: 3, description: 'Subscription functionality and premium access.' },
  { title: 'Launch & deployment', weeks: 2, description: 'Testing, polishing, and app store submission.' },
];

/** Task groups from the brief, used as labels. */
const GROUPS = {
  planning: { name: 'Product planning & requirements', color: 'violet' },
  design: { name: 'UI/UX design', color: 'pink' },
  mobile: { name: 'Mobile app development', color: 'sky' },
  backend: { name: 'Backend & APIs', color: 'amber' },
  auth: { name: 'Authentication & subscriptions', color: 'emerald' },
  qa: { name: 'Testing & quality assurance', color: 'cyan' },
  launch: { name: 'Deployment & launch', color: 'rose' },
} as const;

type GroupKey = keyof typeof GROUPS;
type Owner = 'lead' | 'rachel' | 'jason' | null;

type TaskSeed = {
  title: string;
  description: string;
  group: GroupKey;
  /** Index into PHASES — sets the due date to the end of that phase */
  phase: number;
  status: 'BACKLOG' | 'TODO' | 'IN_PROGRESS';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  owner: Owner;
};

// Nothing is marked done: the project is starting. Foundation work is queued, the rest is backlog.
const TASKS: TaskSeed[] = [
  // Product planning & requirements
  { title: 'Finalise MVP scope and feature list', description: 'Confirm the seven MVP features and what is explicitly out of scope for v1. Features and timing are subject to final scope and approvals.', group: 'planning', phase: 0, status: 'IN_PROGRESS', priority: 'URGENT', owner: 'rachel' },
  { title: 'Write user stories for each MVP feature', description: 'Personalised experience, mood check-in, guided breathwork, mindset library, Confidence Bank, weekly messages, premium subscription.', group: 'planning', phase: 0, status: 'TODO', priority: 'HIGH', owner: 'rachel' },
  { title: 'Define the content plan', description: 'Breathwork scripts, mindset library resources and weekly motivational messages — what exists, what must be written, who signs it off.', group: 'planning', phase: 1, status: 'TODO', priority: 'HIGH', owner: 'rachel' },
  { title: 'Decide free vs premium feature split', description: 'Which features sit behind the premium subscription, and the pricing to test at launch.', group: 'planning', phase: 2, status: 'BACKLOG', priority: 'MEDIUM', owner: 'jason' },
  { title: 'Agree success metrics for the MVP', description: 'What tells us the MVP is working: activation, weekly check-ins, retention, conversion to premium.', group: 'planning', phase: 0, status: 'TODO', priority: 'MEDIUM', owner: 'jason' },

  // UI/UX design
  { title: 'Brand and visual direction', description: 'Encouraging, welcoming and supportive. Running is about confidence, personal growth and wellbeing — not just performance.', group: 'design', phase: 0, status: 'TODO', priority: 'HIGH', owner: 'rachel' },
  { title: 'Design system: colour, type, components', description: 'Shared tokens and components for iOS and Android so screens stay consistent.', group: 'design', phase: 0, status: 'TODO', priority: 'MEDIUM', owner: null },
  { title: 'Onboarding and personalisation flow', description: 'First-run questions about running habits that drive the personalised experience.', group: 'design', phase: 0, status: 'TODO', priority: 'HIGH', owner: null },
  { title: 'Mood check-in screens', description: 'Record how the runner feels before, during and after a run. Must take seconds, not minutes.', group: 'design', phase: 1, status: 'BACKLOG', priority: 'HIGH', owner: null },
  { title: 'Guided breathwork player', description: 'Session picker and in-session screen for relaxation and focus exercises.', group: 'design', phase: 1, status: 'BACKLOG', priority: 'MEDIUM', owner: null },
  { title: 'Confidence Bank and progress screens', description: 'How confidence, progress and achievements are shown over time.', group: 'design', phase: 2, status: 'BACKLOG', priority: 'MEDIUM', owner: null },
  { title: 'Paywall and subscription screens', description: 'Premium upsell, plan selection and manage-subscription states.', group: 'design', phase: 3, status: 'BACKLOG', priority: 'MEDIUM', owner: null },

  // Mobile app development
  { title: 'Flutter project setup and app architecture', description: 'Repo, flavours for dev/staging/prod, state management, navigation and folder structure.', group: 'mobile', phase: 0, status: 'IN_PROGRESS', priority: 'URGENT', owner: 'lead' },
  { title: 'Home: personalised daily content and prompts', description: 'Daily content tailored to the user from their habits and feedback.', group: 'mobile', phase: 1, status: 'BACKLOG', priority: 'HIGH', owner: 'lead' },
  { title: 'Mood check-in feature', description: 'Capture and store check-ins around each run.', group: 'mobile', phase: 1, status: 'BACKLOG', priority: 'HIGH', owner: 'lead' },
  { title: 'Guided breathwork player', description: 'Audio/visual guided breathing exercises with offline-safe playback.', group: 'mobile', phase: 1, status: 'BACKLOG', priority: 'HIGH', owner: 'lead' },
  { title: 'Mindset library', description: 'Browse and read/listen to mental fitness resources.', group: 'mobile', phase: 1, status: 'BACKLOG', priority: 'MEDIUM', owner: 'lead' },
  { title: 'Confidence Bank', description: 'Track confidence, progress and achievements.', group: 'mobile', phase: 2, status: 'BACKLOG', priority: 'HIGH', owner: 'lead' },
  { title: 'Weekly messages', description: 'Motivational content and encouragement delivered in-app and by push.', group: 'mobile', phase: 2, status: 'BACKLOG', priority: 'MEDIUM', owner: 'lead' },

  // Backend & APIs
  { title: 'Backend scaffolding: Node.js REST API', description: 'Service skeleton, environments, logging, error handling and CI.', group: 'backend', phase: 0, status: 'TODO', priority: 'URGENT', owner: 'lead' },
  { title: 'PostgreSQL schema and migrations', description: 'Users, check-ins, content, confidence entries and subscription state.', group: 'backend', phase: 0, status: 'TODO', priority: 'HIGH', owner: 'lead' },
  { title: 'Content API for breathwork, mindset library and weekly messages', description: 'Endpoints and an admin path for publishing content without an app release.', group: 'backend', phase: 1, status: 'BACKLOG', priority: 'HIGH', owner: 'lead' },
  { title: 'Mood check-in and Confidence Bank APIs', description: 'Write and read endpoints with per-user history and aggregates for progress views.', group: 'backend', phase: 2, status: 'BACKLOG', priority: 'HIGH', owner: 'lead' },
  { title: 'Personalisation rules', description: 'Select daily content from running habits and recent check-ins.', group: 'backend', phase: 1, status: 'BACKLOG', priority: 'MEDIUM', owner: 'lead' },

  // Authentication & subscriptions
  { title: 'Firebase authentication', description: 'Email and social sign-in, token verification on the API.', group: 'auth', phase: 0, status: 'TODO', priority: 'HIGH', owner: 'lead' },
  { title: 'Push notifications via Firebase', description: 'Device registration and delivery for weekly messages and reminders.', group: 'auth', phase: 1, status: 'BACKLOG', priority: 'MEDIUM', owner: 'lead' },
  { title: 'Confirm payments approach', description: 'Stripe is the working assumption, subject to final implementation requirements — check app store rules for digital subscriptions before building.', group: 'auth', phase: 2, status: 'BACKLOG', priority: 'HIGH', owner: 'jason' },
  { title: 'Premium subscription and entitlement checks', description: 'Purchase, restore, renewal and gating of premium features.', group: 'auth', phase: 3, status: 'BACKLOG', priority: 'HIGH', owner: 'lead' },

  // Testing & quality assurance
  { title: 'Test plan and device matrix', description: 'Which iOS and Android versions and screen sizes we support and test on.', group: 'qa', phase: 3, status: 'BACKLOG', priority: 'MEDIUM', owner: null },
  { title: 'Beta programme: TestFlight and Play internal testing', description: 'Recruit early runners, collect feedback, triage issues.', group: 'qa', phase: 4, status: 'BACKLOG', priority: 'HIGH', owner: 'rachel' },
  { title: 'Regression pass and bug bash before submission', description: 'Full walkthrough of every MVP feature on both platforms.', group: 'qa', phase: 4, status: 'BACKLOG', priority: 'HIGH', owner: null },

  // Deployment & launch
  { title: 'Apple Developer and Google Play accounts', description: 'Organisation accounts, agreements, tax and banking details.', group: 'launch', phase: 0, status: 'TODO', priority: 'MEDIUM', owner: 'jason' },
  { title: 'Production infrastructure and monitoring', description: 'Hosting, database backups, crash reporting and alerting.', group: 'launch', phase: 3, status: 'BACKLOG', priority: 'MEDIUM', owner: 'lead' },
  { title: 'App store listings, screenshots and privacy policy', description: 'Store copy, imagery, privacy and data-safety declarations.', group: 'launch', phase: 4, status: 'BACKLOG', priority: 'MEDIUM', owner: 'rachel' },
  { title: 'App store submission', description: 'Submit to the App Store and Google Play and respond to review feedback.', group: 'launch', phase: 4, status: 'BACKLOG', priority: 'HIGH', owner: 'lead' },
];

const PROJECT_DESCRIPTION =
  'Design, develop, test, and launch the first version of the Runmora mobile app for iOS and Android. ' +
  'The project covers product design, mobile development, backend infrastructure, testing, and deployment.';

const DOC_BRIEF = `<h2>Runmora</h2>
<p><em>Find your pace. Build your confidence.</em></p>
<p>Runmora is a running and wellbeing app designed to help people build confidence, improve mental fitness, and develop a healthier relationship with running. Rather than focusing primarily on pace and distance, Runmora focuses on how people feel before, during, and after their runs.</p>
<p>The app will provide a personalised experience that combines guided breathwork, mindset resources, confidence tracking, and motivational content to support runners throughout their journey.</p>
<h2>Project objectives</h2>
<ul>
<li>Build a user-friendly mobile app for iOS and Android.</li>
<li>Help runners develop confidence and mental resilience.</li>
<li>Support recovery and emotional wellbeing.</li>
<li>Provide personalised experiences based on users' running habits and feedback.</li>
<li>Establish a scalable foundation for future features and subscriptions.</li>
</ul>`;

const DOC_FEATURES = `<h2>MVP features</h2>
<ul>
<li><strong>Personalised experience</strong> — daily content and prompts tailored to the user.</li>
<li><strong>Mood check-in</strong> — record how users feel around their runs.</li>
<li><strong>Guided breathwork</strong> — breathing exercises for relaxation and focus.</li>
<li><strong>Mindset library</strong> — resources to support mental fitness.</li>
<li><strong>Confidence Bank</strong> — track confidence, progress, and achievements.</li>
<li><strong>Weekly messages</strong> — motivational content and encouragement.</li>
<li><strong>Premium subscription</strong> — paid access to selected premium features.</li>
</ul>`;

const DOC_TECH = `<h2>Technology</h2>
<ul>
<li><strong>Mobile:</strong> Flutter</li>
<li><strong>Backend:</strong> Node.js and REST APIs</li>
<li><strong>Database:</strong> PostgreSQL</li>
<li><strong>Authentication and notifications:</strong> Firebase</li>
<li><strong>Payments:</strong> Stripe, subject to final implementation requirements</li>
</ul>`;

const DOC_TIMELINE = `<h2>Development timeline</h2>
<ol>
${PHASES.map((p) => `<li><strong>${p.title} — ${p.weeks} weeks.</strong> ${p.description}</li>`).join('\n')}
</ol>
<p>Estimated timeline: 4–5 months. Features and timing are subject to final scope and approvals.</p>`;

const DOC_TEAM = `<h2>Team roles</h2>
<ul>
<li><strong>Rachel</strong> — product vision, content, and feedback.</li>
<li><strong>Jason</strong> — business guidance and project support.</li>
<li><strong>Harshit</strong> — technical architecture and development.</li>
</ul>
<h2>How we work</h2>
<p>Tasks move through Backlog → To Do → In Progress → In Review → Testing → Done. Each task carries a label for its task group.</p>`;

const DOC_BRAND = `<h2>Brand direction</h2>
<p>Runmora should feel encouraging, welcoming, and supportive. The brand should communicate that running is not just about performance, but also about confidence, personal growth, and wellbeing.</p>
<p>The experience should make runners feel supported at every stage, whether they are beginners or experienced athletes.</p>
<h3>Pillars</h3>
<p>Running • Mental Fitness • Confidence • Recovery</p>
<h3>Tagline</h3>
<p>Find your pace. Build your confidence.</p>`;

const DOC_ROADMAP = `<h2>Future roadmap</h2>
<p>These features can be considered after the MVP:</p>
<ul>
<li>AI-powered personalised recommendations</li>
<li>Readiness and recovery score</li>
<li>Learning platform</li>
<li>Running community</li>
<li>Wearable integrations</li>
<li>Coach dashboard</li>
</ul>`;

const DOC_SLACK = `<h2>Slack workspace: Runmora</h2>
<p>A collaborative space for the Runmora team to discuss product ideas, share design feedback, coordinate development, track progress, and prepare for launch.</p>
<h3>Alerts from this workspace</h3>
<p>Connect a channel under Settings → Integrations → Slack to post task, comment and mention activity from this project.</p>`;

type DocSeed = { title: string; icon: string; kind: 'FOLDER' | 'PAGE'; html?: string; children?: DocSeed[] };

const DOCS: DocSeed[] = [
  { title: 'Project brief', icon: '📄', kind: 'PAGE', html: DOC_BRIEF },
  {
    title: 'Product',
    icon: '🎯',
    kind: 'FOLDER',
    children: [
      { title: 'MVP features', icon: '✅', kind: 'PAGE', html: DOC_FEATURES },
      { title: 'Future roadmap', icon: '🧭', kind: 'PAGE', html: DOC_ROADMAP },
      { title: 'Brand direction', icon: '🎨', kind: 'PAGE', html: DOC_BRAND },
    ],
  },
  {
    title: 'Delivery',
    icon: '🚀',
    kind: 'FOLDER',
    children: [
      { title: 'Technology', icon: '🔧', kind: 'PAGE', html: DOC_TECH },
      { title: 'Development timeline', icon: '🗓️', kind: 'PAGE', html: DOC_TIMELINE },
    ],
  },
  {
    title: 'Team',
    icon: '🤝',
    kind: 'FOLDER',
    children: [
      { title: 'Team roles', icon: '📌', kind: 'PAGE', html: DOC_TEAM },
      { title: 'Slack workspace brief', icon: '💬', kind: 'PAGE', html: DOC_SLACK },
    ],
  },
];

function addWeeks(from: Date, weeks: number) {
  return new Date(from.getTime() + weeks * 7 * 24 * 60 * 60 * 1000);
}

async function findLead() {
  const email = process.env.RUNMORA_LEAD_EMAIL?.trim().toLowerCase();
  if (email) {
    const user = await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } });
    if (!user) throw new Error(`RUNMORA_LEAD_EMAIL ${email} does not match an existing user`);
    return user;
  }
  const candidates = await prisma.user.findMany({
    where: { role: 'ADMIN', userStatus: 'ACTIVE', name: { contains: 'Harshit', mode: 'insensitive' } },
    orderBy: { createdAt: 'asc' },
  });
  // Prefer the account that already belongs to a workspace
  const lead = candidates.find((u: { primaryCompanyId: string | null }) => u.primaryCompanyId) ?? candidates[0];
  if (!lead) throw new Error('No project lead found — set RUNMORA_LEAD_EMAIL to an existing user');
  return lead;
}

/** Create or link a teammate when a real email was supplied. */
async function ensureTeammate(envKey: string, name: string, companyId: string) {
  const email = process.env[envKey]?.trim().toLowerCase();
  if (!email) return null;
  let user = await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        name,
        role: 'SALES',
        userStatus: 'ACTIVE',
        // Random password: they sign in through "Forgot password" or an invite
        password: await bcrypt.hash(randomBytes(18).toString('base64url'), 12),
        companyId,
        primaryCompanyId: companyId,
      },
    });
    console.log(`  created user ${name} <${email}> — send them a password reset to sign in`);
  }
  return user;
}

async function joinWorkspace(userId: string, companyId: string) {
  await prisma.userCompany.upsert({
    where: { userId_companyId: { userId, companyId } },
    create: { userId, companyId },
    update: {},
  });
}

async function main() {
  // ── Workspace ──────────────────────────────────────────────────────────────
  let company = await prisma.company.findUnique({ where: { slug: COMPANY.slug } });
  if (!company) {
    company = await prisma.company.create({
      data: {
        name: COMPANY.name,
        slug: COMPANY.slug,
        status: 'APPROVED',
        // Round-trip to plain JSON for the Json column
        settings: JSON.parse(
          JSON.stringify({
            ...buildInitialCompanySettings('general'),
            onboarding: completedOnboardingState(),
            projectTaskStatuses: TASK_STATUSES,
          })
        ),
      },
    });
    console.log(`Created workspace ${company.name} (/${company.slug})`);
  } else {
    const settings =
      company.settings && typeof company.settings === 'object' ? (company.settings as Record<string, unknown>) : {};
    await prisma.company.update({
      where: { id: company.id },
      data: { settings: { ...settings, projectTaskStatuses: TASK_STATUSES } },
    });
    console.log(`Workspace ${company.name} already exists — task statuses refreshed`);
  }
  const companyId: string = company.id;

  // ── Team ───────────────────────────────────────────────────────────────────
  const lead = await findLead();
  const rachel = await ensureTeammate('RUNMORA_RACHEL_EMAIL', 'Rachel', companyId);
  const jason = await ensureTeammate('RUNMORA_JASON_EMAIL', 'Jason', companyId);
  const team = { lead, rachel, jason };
  for (const member of [lead, rachel, jason]) {
    if (member) await joinWorkspace(member.id, companyId);
  }
  console.log(
    `Team: ${lead.name} (lead)` +
      `${rachel ? ', Rachel' : ''}${jason ? ', Jason' : ''}` +
      `${!rachel || !jason ? ' — Rachel/Jason not added (no email given); their tasks are left unassigned' : ''}`
  );

  // ── Project ────────────────────────────────────────────────────────────────
  const existing = await prisma.project.findFirst({ where: { companyId, name: PROJECT_NAME } });
  if (existing && !FORCE) {
    console.log(`Project "${PROJECT_NAME}" already exists (${existing.id}). Re-run with --force to rebuild it.`);
    return;
  }
  if (existing) {
    await prisma.project.delete({ where: { id: existing.id } }); // cascades tasks, milestones, docs, members
    console.log('Removed the existing project (--force)');
  }

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const totalWeeks = PHASES.reduce((sum, p) => sum + p.weeks, 0);

  let elapsed = 0;
  const phaseEnds = PHASES.map((p) => addWeeks(start, (elapsed += p.weeks)));

  const project = await prisma.project.create({
    data: {
      name: PROJECT_NAME,
      description: PROJECT_DESCRIPTION,
      status: 'ACTIVE',
      projectType: 'webapp',
      progress: 0,
      startDate: start,
      endDate: addWeeks(start, totalWeeks),
      companyId,
      pmUserId: lead.id,
      milestones: {
        create: PHASES.map((p, i) => ({
          title: `${p.title} — ${p.weeks} weeks`,
          description: p.description,
          status: i === 0 ? 'IN_PROGRESS' : 'PENDING',
          dueDate: phaseEnds[i],
          sortOrder: i,
        })),
      },
      members: {
        create: [
          { userId: lead.id, role: 'DEV' },
          ...(rachel ? [{ userId: rachel.id, role: 'PM' }] : []),
          ...(jason ? [{ userId: jason.id, role: 'OTHER' }] : []),
        ],
      },
    },
  });
  console.log(`Created project "${project.name}" (${project.id}) with ${PHASES.length} milestones`);

  // ── Labels (task groups) ───────────────────────────────────────────────────
  const labelIds = {} as Record<GroupKey, string>;
  for (const key of Object.keys(GROUPS) as GroupKey[]) {
    const label = await prisma.projectLabel.upsert({
      where: { companyId_name: { companyId, name: GROUPS[key].name } },
      create: { companyId, name: GROUPS[key].name, color: GROUPS[key].color },
      update: {},
    });
    labelIds[key] = label.id;
  }

  // ── Tasks ──────────────────────────────────────────────────────────────────
  const sortByStatus: Record<string, number> = {};
  for (const seed of TASKS) {
    const assignee = seed.owner ? team[seed.owner] : null;
    const sortOrder = (sortByStatus[seed.status] = (sortByStatus[seed.status] ?? -1) + 1);
    const task = await prisma.projectTask.create({
      data: {
        projectId: project.id,
        title: seed.title,
        description: seed.description,
        descriptionHtml: `<p>${seed.description}</p>`,
        status: seed.status,
        priority: seed.priority,
        assigneeId: assignee?.id ?? null,
        reporterId: lead.id,
        dueDate: phaseEnds[seed.phase],
        sortOrder,
        labels: { create: { labelId: labelIds[seed.group] } },
        watchers: { create: { userId: lead.id } },
        activities: {
          create: { actorId: lead.id, eventType: 'CREATED', description: `${lead.name || 'Lead'} created this task` },
        },
      },
    });
    if (assignee && assignee.id !== lead.id) {
      await prisma.projectTaskWatcher.create({ data: { taskId: task.id, userId: assignee.id } });
    }
  }
  console.log(`Created ${TASKS.length} tasks across ${Object.keys(GROUPS).length} task groups`);

  // ── Docs ───────────────────────────────────────────────────────────────────
  let docCount = 0;
  const createDocs = async (nodes: DocSeed[], parentId: string | null) => {
    for (let i = 0; i < nodes.length; i += 1) {
      const node = nodes[i];
      const doc = await prisma.projectDoc.create({
        data: {
          projectId: project.id,
          parentId,
          kind: node.kind,
          title: node.title,
          icon: node.icon,
          contentHtml: node.kind === 'PAGE' ? (node.html ?? '') : null,
          sortOrder: i,
          createdById: lead.id,
          updatedById: lead.id,
        },
      });
      docCount += 1;
      if (node.children) await createDocs(node.children, doc.id);
    }
  };
  await createDocs(DOCS, null);
  console.log(`Created ${docCount} docs`);

  console.log(`\nDone. Open /${COMPANY.slug}/dashboard/projects/${project.id}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined);
  });
