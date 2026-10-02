/**
 * Seed the Runmora workspace (formerly Rungevity) with its two delivery projects:
 *
 *   1. Runmora – Mobile App      Flutter app (repo: Rungevity)
 *   2. Runmora – Landing Page    Next.js waitlist site (repo: rungevityweb)
 *
 * Tasks, milestones and dates reflect the work already done in both repos (as of
 * 2 Oct 2026) and the plan from the App Ideas source document. Docs carry the
 * Runmora brand throughout.
 *
 * Usage:
 *   npx tsx scripts/seed-runmora-workspace.ts
 *   npx tsx scripts/seed-runmora-workspace.ts --force   # rebuild both projects from scratch
 *
 * The earlier single "Runmora – Mobile App MVP" project is removed when it still holds
 * only seed data (no comments, worklogs or task changes); otherwise pass --force.
 *
 * Team (looked up among the workspace's members by name, or by email when set):
 *   RUNMORA_LEAD_EMAIL    project lead / developer (default: Harshit)
 *   RUNMORA_RACHEL_EMAIL  founder — product vision, content and voice
 *   RUNMORA_JASON_EMAIL   business guidance and project support
 */
import 'dotenv/config';
import { prisma } from '../lib/prisma';
import { buildInitialCompanySettings } from '../lib/workspace-config';
import { completedOnboardingState } from '../lib/onboarding/company-onboarding';
import { computeProgressFromTasks } from '../lib/projects/task-board';

const FORCE = process.argv.includes('--force');

const COMPANY = { name: 'Runmora', slug: 'runmora' };
const LEGACY_PROJECT_NAME = 'Runmora – Mobile App MVP';

const TASK_STATUSES = [
  { id: 'BACKLOG', label: 'Backlog', color: 'bg-slate-400' },
  { id: 'TODO', label: 'To Do', color: 'bg-sky-500' },
  { id: 'IN_PROGRESS', label: 'In Progress', color: 'bg-amber-500' },
  { id: 'IN_REVIEW', label: 'In Review', color: 'bg-violet-500' },
  { id: 'TESTING', label: 'Testing', color: 'bg-cyan-500' },
  { id: 'DONE', label: 'Done', color: 'bg-emerald-500', isDone: true },
].map((status, order) => ({ ...status, order }));

/** Task groups, shown as labels (shared across the workspace). */
const LABELS = {
  planning: { name: 'Product planning & requirements', color: 'violet' },
  design: { name: 'UI/UX design', color: 'pink' },
  mobile: { name: 'Mobile app development', color: 'sky' },
  backend: { name: 'Backend & APIs', color: 'amber' },
  auth: { name: 'Authentication & subscriptions', color: 'emerald' },
  qa: { name: 'Testing & quality assurance', color: 'cyan' },
  launch: { name: 'Deployment & launch', color: 'rose' },
  content: { name: 'Content & copy', color: 'lime' },
  rebrand: { name: 'Runmora rebrand', color: 'orange' },
  web: { name: 'Website build', color: 'indigo' },
  seo: { name: 'SEO & analytics', color: 'teal' },
} as const;

type LabelKey = keyof typeof LABELS;
type Owner = 'lead' | 'rachel' | 'jason' | null;
type Status = 'BACKLOG' | 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'TESTING' | 'DONE';
type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

type TaskSeed = {
  title: string;
  description: string;
  label: LabelKey;
  status: Status;
  priority: Priority;
  owner: Owner;
  /** Index into the project's milestones — the task's due date is that milestone's */
  milestone: number;
  /** For DONE tasks: the day the work landed (from the repo history) */
  doneOn?: string;
};

type MilestoneSeed = {
  title: string;
  description: string;
  due: string;
  status: 'DONE' | 'IN_PROGRESS' | 'PENDING';
};

type DocSeed = { title: string; icon: string; kind: 'FOLDER' | 'PAGE'; html?: string; children?: DocSeed[] };

type ProjectSeed = {
  name: string;
  description: string;
  projectType: string;
  start: string;
  milestones: MilestoneSeed[];
  tasks: TaskSeed[];
  docs: DocSeed[];
};

/** Dates are calendar days in India time, where the work happened. */
function day(iso: string) {
  return new Date(`${iso}T12:00:00+05:30`);
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const list = (items: string[]) => `<ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul>`;
const table = (head: string[], rows: string[][]) =>
  `<table><tbody><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr>${rows
    .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`)
    .join('')}</tbody></table>`;

// ═══════════════════════════════════════════════════════════════════════════════
// Shared copy
// ═══════════════════════════════════════════════════════════════════════════════

const MAIN_MESSAGE = `<blockquote><p><strong>Confidence comes from evidence.</strong> Build it when you can. Bank it as you go. Lean on it when you need it.</p></blockquote>`;

const SURVEY_ROWS: string[][] = [
  ['A bad run affects their confidence', '79%', 'All respondents'],
  ['Changed or skipped a later run because of a bad one', '39%', 'All respondents'],
  ['Rated mental recovery as highly important', '75%', 'All respondents'],
  ['…yet do nothing specifically to support it', '37%', 'All respondents'],
  ['Effect of a bad run lasts at least a day', '51%', 'All respondents'],
  ['Compare themselves with others often or almost every run', '52%', 'All respondents'],
  ['Compare themselves with a past version of themselves', '61%', 'All respondents'],
  ['Comparison knocks their confidence', '56%', 'All respondents'],
  ['Running inner voice is critical, frustrated, annoyed or defeatist', '68%', 'All respondents'],
  ['Wanted to feel they were still progressing while unable to run', '63%', 'Injured, n=49'],
  ['Worried they would never get back to where they were', '55%', 'Injured, n=49'],
  ['Felt guilty about not running', '51%', 'Injured, n=49'],
  ['Lost confidence', '47%', 'Injured, n=49'],
  ['Compared themselves with their past self', '47%', 'Injured, n=49'],
  ['Felt like they were no longer a runner', '31%', 'Injured, n=49'],
];

const DOC_TEAM = `<h2>Team roles</h2>
${list([
  '<strong>Rachael</strong> — founder. Product vision, the Runmora voice, mindset content (scripts, videos, message bank) and prototype feedback.',
  '<strong>Jason</strong> — business guidance and project support: launch scope, pricing, accounts, legal and store setup.',
  '<strong>Harshit</strong> — technical architecture and development of the mobile app and the landing page.',
])}
<p>The landing-page brief in the App Ideas document is addressed to Silas (web) and draws on Rachael's prototype feedback.</p>
<h2>How we work</h2>
<p>Tasks move through Backlog → To Do → In Progress → In Review → Testing → Done. Each task carries a label for its task group, and its due date is the milestone it belongs to.</p>
<p>Source of truth for product decisions: the <em>App Ideas</em> document (product thinking, content banks, prototype feedback and the landing-page brief).</p>`;

const DOC_SLACK = `<h2>Slack workspace: Runmora</h2>
<p>A collaborative space for the Runmora team to discuss product ideas, share design feedback, coordinate development, track progress, and prepare for launch.</p>
<h3>Alerts from this workspace</h3>
<p>Connect a channel under Settings → Integrations → Slack to post task, comment and mention activity from these projects.</p>`;

const DOC_REBRAND_NOTE = `<h2>Rungevity is now Runmora</h2>
<p>The product was developed as <strong>Rungevity</strong> and has been renamed <strong>Runmora</strong>. Every new document, screen and message uses Runmora. Older material — the App Ideas document, the survey ("Rungevity runner questionnaire, 2026"), repo names and app ids — still carries the old name until each item on the rebrand checklist is done.</p>
<p>Keep: <strong>Confidence Bank™</strong>, <strong>Bank a Moment</strong>, <strong>Daily Goals</strong>, Monday Mindset / Thursday Top Tips / Saturday Motivation / Sunday Reflection. Rename: "The Rungevity Method", "the Rungevity Guide", "Rungevity question bank", "Rungevity-approved material" → Runmora.</p>`;

// ═══════════════════════════════════════════════════════════════════════════════
// Project 1 — Mobile app
// ═══════════════════════════════════════════════════════════════════════════════

const APP_MILESTONES: MilestoneSeed[] = [
  { title: 'Prototype plan', description: 'Scope, milestones M0–M5 and architecture for an offline Flutter prototype (PROTOTYPE_PLAN.md).', due: '2026-09-17', status: 'DONE' },
  { title: 'Offline prototype (M0–M5)', description: 'Every planned screen working on-device: onboarding, check-in, breathwork, mindset library, Confidence Bank, progress, paywall UI.', due: '2026-09-28', status: 'DONE' },
  { title: 'App Ideas feedback applied', description: "Rachael's prototype feedback: five-tab shell, opening quote, personalised setup, Daily Goals, rebuilt Confidence Bank, Tools tab, reflections, weekly messages.", due: '2026-09-29', status: 'DONE' },
  { title: 'Device & runner testing', description: 'Emulator pass and a full pass testing as a runner, with fixes; prototype APK shared for review.', due: '2026-09-30', status: 'DONE' },
  { title: 'Runmora rebrand', description: 'Rename everything user-facing, the Dart package and the app identity from Rungevity to Runmora.', due: '2026-10-09', status: 'IN_PROGRESS' },
  { title: 'MVP foundation', description: 'Node.js API, PostgreSQL, Firebase Auth, remote repositories with sync, AI calls behind the API.', due: '2026-11-06', status: 'PENDING' },
  { title: 'Content & brand final', description: 'Final logo and icons, recorded breathwork and mindset videos, reviewed copy and message bank.', due: '2026-11-20', status: 'PENDING' },
  { title: 'Premium & payments', description: 'Store in-app subscriptions with server-side entitlements, real analytics, push via FCM.', due: '2026-12-04', status: 'PENDING' },
  { title: 'Beta', description: 'TestFlight and Play internal testing with real runners; regression pass on the device matrix.', due: '2026-12-25', status: 'PENDING' },
  { title: 'Store launch', description: 'Store listings, privacy and data-safety declarations, submission and review.', due: '2027-01-15', status: 'PENDING' },
];

const APP_TASKS: TaskSeed[] = [
  // ── Planning ──────────────────────────────────────────────────────────────
  { title: 'Write the prototype plan and milestones', description: 'PROTOTYPE_PLAN.md: offline-first Flutter prototype, milestones M0–M5, repository seams for a later backend.', label: 'planning', status: 'DONE', priority: 'HIGH', owner: 'lead', milestone: 0, doneOn: '2026-09-17' },
  { title: 'Prototype feedback round (App Ideas)', description: 'Rachael reviewed the prototype screen by screen: start-up pages, onboarding, home, goals, Confidence Bank, tools, notifications. Captured in the App Ideas document.', label: 'planning', status: 'DONE', priority: 'HIGH', owner: 'rachel', milestone: 2, doneOn: '2026-09-28' },
  { title: 'Confirm launch scope for planned features', description: 'Agree which of these ship at launch: Reframe, Past Me Comparison, "Show me my evidence" retrieval, injured/poorly status switching, personalised weekly messages, ongoing personalised monthly questions, community, human coach access, integrations. The landing page must match.', label: 'planning', status: 'TODO', priority: 'URGENT', owner: 'jason', milestone: 5 },
  { title: 'Decide free vs premium split and pricing', description: 'The prototype paywall shows placeholder prices (£7.99/month, £59.99/year). Decide what sits behind premium before anything is published.', label: 'planning', status: 'TODO', priority: 'HIGH', owner: 'jason', milestone: 7 },
  { title: 'Agree MVP success metrics', description: 'Activation (setup completed, first Bank entry), weekly check-ins, Bank a Moment frequency, retention, conversion to premium. No streak-style metrics.', label: 'planning', status: 'BACKLOG', priority: 'MEDIUM', owner: 'jason', milestone: 8 },
  { title: 'Coach overview: scope a coach element', description: 'Rachael asked whether a coach could get an overview. The prototype stores "Message a coach" on the device only. Decide if and when a coach dashboard belongs on the roadmap.', label: 'planning', status: 'BACKLOG', priority: 'LOW', owner: 'rachel', milestone: 9 },

  // ── Design ────────────────────────────────────────────────────────────────
  { title: 'Design tokens, light and dark themes', description: 'Deep green primary, sand surfaces, amber reserved for the Confidence Bank; Manrope bundled; full dark mode.', label: 'design', status: 'DONE', priority: 'HIGH', owner: 'lead', milestone: 1, doneOn: '2026-09-28' },
  { title: 'Opening quote screen over painted landscapes', description: 'A calming quote before the first check-in each day, chosen by context (injury, race week, recent comparison). 60 quotes.', label: 'design', status: 'DONE', priority: 'MEDIUM', owner: 'lead', milestone: 2, doneOn: '2026-09-29' },
  { title: 'Animated splash and launcher icons', description: 'Breathing tile and morphing arcs; Android adaptive and monochrome icons generated from the in-app mark.', label: 'design', status: 'DONE', priority: 'LOW', owner: 'lead', milestone: 3, doneOn: '2026-09-29' },
  { title: 'Final Runmora logo, colours and icon set', description: 'The current brand mark, colours and icons are placeholders. Needed for the app, the store listings and the landing page.', label: 'design', status: 'TODO', priority: 'HIGH', owner: 'rachel', milestone: 6 },

  // ── Mobile app features ───────────────────────────────────────────────────
  { title: 'Onboarding slides and notification opt-in', description: 'Build confidence. Go further. Daily Goals, Tools, Confidence Bank™ and Insights explained; messages are opt-in — "No streaks. No guilt. Just the support you choose."', label: 'mobile', status: 'DONE', priority: 'HIGH', owner: 'lead', milestone: 1, doneOn: '2026-09-28' },
  { title: 'Personalised setup: focus, support areas, first check-in, goal and Bank entry', description: 'Focus areas (running, cycling, strength, everyday life), what to work on, first timestamped check-in with injured/poorly, first Daily Goal with outcome→action help, first Confidence Bank moment — so Home is never empty.', label: 'mobile', status: 'DONE', priority: 'URGENT', owner: 'lead', milestone: 2, doneOn: '2026-09-29' },
  { title: 'Quick tour, re-openable from Profile', description: 'Short tutorial after setup with a button to watch it again.', label: 'mobile', status: 'DONE', priority: 'LOW', owner: 'lead', milestone: 2, doneOn: '2026-09-29' },
  { title: 'Five-tab shell: Home, Goals, Confidence Bank, Tools, Progress', description: 'Confidence Bank in the centre; breathwork and the mindset library moved out of the tabs.', label: 'mobile', status: 'DONE', priority: 'HIGH', owner: 'lead', milestone: 2, doneOn: '2026-09-29' },
  { title: 'Home: "For you right now" recommendations', description: 'Rules engine picks content by check-in state and situation: recovery content when injured or poorly, Race Ready only near a race. Today\'s goals and a Confidence Bank "Remember this?" card.', label: 'mobile', status: 'DONE', priority: 'HIGH', owner: 'lead', milestone: 2, doneOn: '2026-09-29' },
  { title: 'Mood check-in', description: 'Up to two feelings, injured/poorly, and kind of day. Every check-in is kept with its time so patterns can be shown later.', label: 'mobile', status: 'DONE', priority: 'HIGH', owner: 'lead', milestone: 2, doneOn: '2026-09-29' },
  { title: 'Daily Goals', description: 'Goals by kind of day (easy, quality, long, strength, rest, injury, everyday), outcome-to-action suggestions the user chooses from, a usual-week plan, and weekly evidence offered for banking.', label: 'mobile', status: 'DONE', priority: 'URGENT', owner: 'lead', milestone: 2, doneOn: '2026-09-29' },
  { title: 'Confidence Bank: Bank a Moment, tags, revisit', description: 'One text box with prompts that stay visible while typing, common and personal tags, backdating, quiet classification into the seven areas, and a full-screen revisit mode.', label: 'mobile', status: 'DONE', priority: 'URGENT', owner: 'lead', milestone: 2, doneOn: '2026-09-29' },
  { title: 'Tools tab: Reframe and guided tools', description: 'Reframe plus scripted tools from the tool map: Evidence Challenge, Past Me, Back to My Lane, Fact or Story, Advice Flip, Make It Smaller, STEADY, Wobble, Still Moving Forward, Freedom Reset, Race Ready.', label: 'mobile', status: 'DONE', priority: 'HIGH', owner: 'lead', milestone: 2, doneOn: '2026-09-29' },
  { title: 'Guided breathwork player', description: '10 sessions with an animated breath guide, background audio and lock-screen controls.', label: 'mobile', status: 'DONE', priority: 'MEDIUM', owner: 'lead', milestone: 1, doneOn: '2026-09-28' },
  { title: 'Mindset library and blog', description: 'Read / Listen / Watch filters, block renderer, search by meaning. 13 items and 3 blog posts as first drafts.', label: 'mobile', status: 'DONE', priority: 'MEDIUM', owner: 'lead', milestone: 1, doneOn: '2026-09-28' },
  { title: 'Reflection & Recovery blocks', description: 'Monthly reflection for runners, everyday life, strength & conditioning and injury (Blocks 1–4), with "Bank it" after each.', label: 'mobile', status: 'DONE', priority: 'HIGH', owner: 'lead', milestone: 2, doneOn: '2026-09-29' },
  { title: 'Weekly messages: Mon / Thu / Sat / Sun', description: 'Monday Mindset, Thursday Top Tips, Saturday Motivation, Sunday Reflection — each optional. 318 messages for runners and everyday users, scheduled as local notifications.', label: 'mobile', status: 'DONE', priority: 'HIGH', owner: 'lead', milestone: 2, doneOn: '2026-09-29' },
  { title: 'Races and events with race-day Bank reminders', description: 'Add race dates; a Confidence Bank review is offered the night before and on race morning.', label: 'mobile', status: 'DONE', priority: 'MEDIUM', owner: 'lead', milestone: 2, doneOn: '2026-09-29' },
  { title: 'Progress and insights', description: 'Four-week mood grid, moments per week, evidence tiles and an AI weekly reflection.', label: 'mobile', status: 'DONE', priority: 'MEDIUM', owner: 'lead', milestone: 1, doneOn: '2026-09-28' },
  { title: 'Settings, profile and notification preferences', description: 'Theme, AI on/off with usage, races, per-message notification choices.', label: 'mobile', status: 'DONE', priority: 'LOW', owner: 'lead', milestone: 2, doneOn: '2026-09-29' },
  { title: 'Paywall screens (simulated purchase)', description: 'Premium upsell and plan selection UI. Purchase is simulated; real store purchases are a separate task.', label: 'mobile', status: 'DONE', priority: 'MEDIUM', owner: 'lead', milestone: 1, doneOn: '2026-09-28' },
  { title: 'AI features (prototype, Gemini)', description: 'Pep talk, check-in reflection, moment classification, goal suggestions, Reframe, weekly reflection, Guide chat and search by meaning. Calls Gemini from the device — must move behind the API.', label: 'mobile', status: 'DONE', priority: 'HIGH', owner: 'lead', milestone: 2, doneOn: '2026-09-29' },
  { title: 'Talk: the Runmora Guide', description: 'Guide chat with safety rules and an emergency hand-off. "Message a coach" only stores on the device. Needs a decision on launch scope (Guide vs human coach).', label: 'mobile', status: 'IN_REVIEW', priority: 'MEDIUM', owner: 'rachel', milestone: 5 },

  // ── Rebrand ───────────────────────────────────────────────────────────────
  { title: 'Rename user-facing copy, AI prompts and content to Runmora', description: 'About 126 occurrences in lib/ (onboarding, setup, home, goals, Bank, Talk, notifications, profile; "The Rungevity Method™"; AI prompts "You are Rungevity…") and 33 in bundled content (authors "The Rungevity team").', label: 'rebrand', status: 'IN_PROGRESS', priority: 'URGENT', owner: 'lead', milestone: 4 },
  { title: 'Rename the Dart package and classes', description: 'pubspec name rungevity → runmora (64 package imports across lib, test and tool); RungevityApp, RungevityAudioHandler, RungevityMessage.', label: 'rebrand', status: 'TODO', priority: 'HIGH', owner: 'lead', milestone: 4 },
  { title: 'Choose the final app id and bundle id', description: 'Currently com.rungevity.rungevity on Android and iOS. Must be decided before the first store upload — it cannot change afterwards. Then update the Kotlin package path, app labels and display names.', label: 'rebrand', status: 'TODO', priority: 'URGENT', owner: 'jason', milestone: 4 },
  { title: 'Rename notification channels and lock-screen artist', description: 'Channel id rungevity_messages and the names "Rungevity messages" / "Daily Rungevity check-in"; media artist "Rungevity".', label: 'rebrand', status: 'TODO', priority: 'MEDIUM', owner: 'lead', milestone: 4 },
  { title: 'Update README, plan docs and the repo name', description: 'README (7), PROTOTYPE_PLAN (10), .iml files, APK file name, and the repository folder.', label: 'rebrand', status: 'TODO', priority: 'LOW', owner: 'lead', milestone: 4 },

  // ── Backend ───────────────────────────────────────────────────────────────
  { title: 'Node.js REST API scaffolding', description: 'Service skeleton, environments, logging, error handling and CI. Nothing exists yet — the prototype is fully on-device.', label: 'backend', status: 'TODO', priority: 'URGENT', owner: 'lead', milestone: 5 },
  { title: 'PostgreSQL schema and migrations', description: 'Users and profiles (focus and support areas), check-ins, Daily Goals, Confidence Bank entries and tags, reflections, message preferences, races, entitlements.', label: 'backend', status: 'TODO', priority: 'HIGH', owner: 'lead', milestone: 5 },
  { title: 'Remote repositories and on-device data sync', description: 'Remote versions of each repository behind the existing interfaces, and a one-time upload of Hive data from prototype users.', label: 'backend', status: 'BACKLOG', priority: 'HIGH', owner: 'lead', milestone: 5 },
  { title: 'Move AI calls behind the API', description: 'Server-side Gemini calls with the prompts, guardrails and usage limits; the app should never hold the key.', label: 'backend', status: 'BACKLOG', priority: 'HIGH', owner: 'lead', milestone: 5 },
  { title: 'Rotate the Gemini key and stop bundling .env', description: 'pubspec bundles .env as an asset, so the key shipped inside the prototype APK. Rotate it now and remove .env from assets.', label: 'backend', status: 'TODO', priority: 'URGENT', owner: 'lead', milestone: 4 },
  { title: 'Content API or CMS', description: 'Quotes, messages, tools, mindset items, breathwork and reflections are bundled JSON today. Publish content without an app release.', label: 'backend', status: 'BACKLOG', priority: 'MEDIUM', owner: 'lead', milestone: 6 },

  // ── Auth, subscriptions, notifications ────────────────────────────────────
  { title: 'Firebase project and config files', description: 'Create the Firebase project; add google-services.json and GoogleService-Info.plist.', label: 'auth', status: 'TODO', priority: 'HIGH', owner: 'lead', milestone: 5 },
  { title: 'Replace the prototype login with Firebase Auth', description: 'The prototype accepts any email and 6-character password and keeps accounts on the device. Add email and social sign-in with token checks on the API.', label: 'auth', status: 'BACKLOG', priority: 'HIGH', owner: 'lead', milestone: 5 },
  { title: 'Push notifications via FCM', description: 'Server-driven messages and reminders. Weekly messages work today as local notifications.', label: 'auth', status: 'BACKLOG', priority: 'MEDIUM', owner: 'lead', milestone: 7 },
  { title: 'In-app subscriptions and entitlements', description: 'App Store and Google Play purchases (e.g. via RevenueCat), restore and renewal, entitlement checked on the server. Stripe is not allowed for in-app digital subscriptions — web only.', label: 'auth', status: 'BACKLOG', priority: 'HIGH', owner: 'lead', milestone: 7 },
  { title: 'Wire analytics', description: '17 event names are defined but only print to the console. Pick a provider and add privacy-friendly tracking.', label: 'auth', status: 'BACKLOG', priority: 'MEDIUM', owner: 'lead', milestone: 7 },

  // ── Content ───────────────────────────────────────────────────────────────
  { title: 'Record breathwork audio', description: 'The 6 tracks in the prototype are synthesised placeholders.', label: 'content', status: 'TODO', priority: 'MEDIUM', owner: 'rachel', milestone: 6 },
  { title: 'Record the mindset videos', description: 'Scripts exist in the App Ideas document (A Thought Is Not a Prediction, Past Me, The Bad Run Reset, The Advice Flip and more). The prototype uses sample clips.', label: 'content', status: 'TODO', priority: 'MEDIUM', owner: 'rachel', milestone: 6 },
  { title: 'Review first-draft copy and the message bank', description: '318 weekly messages, 60 opening quotes, Daily Goal examples and reflection questions — check voice and tagging.', label: 'content', status: 'TODO', priority: 'HIGH', owner: 'rachel', milestone: 6 },

  // ── QA ────────────────────────────────────────────────────────────────────
  { title: 'Unit tests for models, engines and repositories', description: '74 tests: practice flows, recommendation engine, models, AI router and service, Talk, mood and Bank repositories, moment classifier.', label: 'qa', status: 'DONE', priority: 'MEDIUM', owner: 'lead', milestone: 3, doneOn: '2026-09-30' },
  { title: 'Emulator test pass and fixes', description: 'First Bank entry from setup, injured suggestions from recovery content, second feeling counted, unsaved-Bank warning, nav overflow and wording.', label: 'qa', status: 'DONE', priority: 'HIGH', owner: 'lead', milestone: 3, doneOn: '2026-09-29' },
  { title: 'Test as a runner: fixes', description: 'Quick tour closing, back-step in guided tools, lock-screen controls in release builds, bundled font, email validation, moment classifier for resilience phrases, UI polish.', label: 'qa', status: 'DONE', priority: 'HIGH', owner: 'lead', milestone: 3, doneOn: '2026-09-30' },
  { title: 'Share prototype APK for review', description: 'Rungevity-prototype-2026-09-30.apk built for the team.', label: 'qa', status: 'DONE', priority: 'MEDIUM', owner: 'lead', milestone: 3, doneOn: '2026-09-30' },
  { title: 'Prototype usability sessions with 5–8 runners', description: 'Planned in M5 of the prototype plan; not done yet. Include injured and returning runners.', label: 'qa', status: 'TODO', priority: 'HIGH', owner: 'rachel', milestone: 6 },
  { title: 'Widget and integration tests for key flows', description: 'Setup, Daily Goals, Confidence Bank, Tools and paywall have no widget tests yet.', label: 'qa', status: 'BACKLOG', priority: 'MEDIUM', owner: 'lead', milestone: 8 },
  { title: 'CI pipeline', description: 'Analyse, test and build on every push.', label: 'qa', status: 'BACKLOG', priority: 'MEDIUM', owner: 'lead', milestone: 5 },
  { title: 'Beta: TestFlight and Play internal testing', description: 'Recruit runners, collect feedback, triage issues.', label: 'qa', status: 'BACKLOG', priority: 'HIGH', owner: 'rachel', milestone: 8 },
  { title: 'Regression pass on the device matrix', description: 'Every MVP feature on supported iOS and Android versions before submission.', label: 'qa', status: 'BACKLOG', priority: 'HIGH', owner: 'lead', milestone: 8 },

  // ── Launch ────────────────────────────────────────────────────────────────
  { title: 'Apple Developer and Google Play accounts', description: 'Organisation accounts, agreements, tax and banking details.', label: 'launch', status: 'TODO', priority: 'HIGH', owner: 'jason', milestone: 7 },
  { title: 'Release signing', description: 'Android release builds use the debug key today; create the upload keystore. Set the iOS team and provisioning.', label: 'launch', status: 'BACKLOG', priority: 'HIGH', owner: 'lead', milestone: 8 },
  { title: 'Production infrastructure and monitoring', description: 'Hosting, database backups, crash reporting and alerting.', label: 'launch', status: 'BACKLOG', priority: 'MEDIUM', owner: 'lead', milestone: 7 },
  { title: 'Store listings, screenshots and privacy policy', description: 'Store copy and imagery, privacy policy, and Apple / Google data-safety declarations.', label: 'launch', status: 'BACKLOG', priority: 'MEDIUM', owner: 'rachel', milestone: 9 },
  { title: 'App store submission', description: 'Submit to the App Store and Google Play and respond to review feedback.', label: 'launch', status: 'BACKLOG', priority: 'HIGH', owner: 'lead', milestone: 9 },
];

const APP_DOC_BRIEF = `<h2>Runmora</h2>
<p><em>The mindset app built around your evidence.</em></p>
${MAIN_MESSAGE}
<p>Runmora helps people train the part of performance that is often overlooked — their mind. It is built for runners first, and for the moments that test their confidence: a start-line wobble, one bad run outweighing weeks of training, comparison, injury or illness. It also works for cycling, strength and everyday life.</p>
<p>People check in, choose one useful Daily Goal, and Bank a Moment in their own words. Weekly and monthly reflection helps them see what that evidence adds up to, and when doubt arrives Runmora brings relevant evidence and practical tools back to them.</p>
<h2>Project goal</h2>
<p>Take the working Flutter prototype to a launched MVP on iOS and Android: rebrand to Runmora, add a backend with real accounts and sync, real subscriptions, final content and brand, beta with runners, and store submission.</p>
<h2>Where we are (2 Oct 2026)</h2>
${list([
  'An offline prototype with every planned screen is built and has been through Rachael\'s feedback round, emulator testing and a test pass as a runner.',
  'A prototype APK has been shared for review.',
  'Next: the Runmora rebrand, then the MVP foundation (API, database, Firebase Auth).',
])}`;

const APP_DOC_LOOP = `<h2>The Runmora loop</h2>
<p>Check in → Choose → Reflect → Deposit → Review → Adapt.</p>
${table(['Step', 'What happens'], [
  ['Check in', 'How are you feeling right now? Up to two feelings, plus injured or poorly. Every check-in is timestamped.'],
  ['Choose', 'One useful Daily Goal for the kind of day it is. One is enough.'],
  ['Reflect', 'A tool when it is needed; a short weekly or monthly reflection.'],
  ['Deposit', 'Bank a Moment — the person\'s own words, big or small.'],
  ['Review', 'Revisit the evidence: "Remember this?", race-morning reviews, monthly blocks.'],
  ['Adapt', 'Recommendations, messages and questions shaped by what Runmora has learned.'],
])}
<p>Runmora should never feel like six tasks a day. A check-in and one goal is a complete day; everything else is support people choose.</p>
<h3>The seven areas</h3>
<p>Behind the scenes, Bank entries, tools and messages are classified into Self-Belief, Trust, Process Focus, Resilience, Self-Talk, Comparison and Perspective, plus Recovery and Race.</p>`;

const APP_DOC_ONBOARDING = `<h2>Onboarding and first run</h2>
<p>Start-up pages explain the app simply: <strong>Build confidence. Go further.</strong> Daily Goals, Tools, Confidence Bank™ and Insights. "One check-in a day helps Runmora learn what works for you." Messages are chosen by the user — <em>No streaks. No guilt. Just the support you choose.</em></p>
<ol>
<li><strong>Your focus</strong> — Running, Cycling, Strength and conditioning, Everyday life (select all). Stored as <code>focus_areas</code>.</li>
<li><strong>What would you like help with?</strong> — Build my confidence, Be more consistent, Manage nerves or anxiety, Handle setbacks better, Be kinder to myself, Stop comparing, Stay motivated, Focus on what I can control, Recover / return from injury… Stored as <code>support_areas</code>.</li>
<li><strong>Your first check-in</strong> — up to two of Excited, Confident, Motivated, Calm, Steady, Anxious, Low confidence, Frustrated, Tired; plus Injured / Poorly. The first real data point.</li>
<li><strong>Your first Daily Goal</strong> — "What's one thing you CAN do today?" If someone types an outcome such as "Sleep better", Runmora offers actions they control and they choose.</li>
<li><strong>Start your Confidence Bank</strong> — "Your evidence starts here." Add a first moment from any part of life, or skip for now.</li>
</ol>
<p>Then Home is already personal: today's goal, a relevant tool (an injury reframe, not race tips, for someone injured), and "Remember this?" with their first moment. A short tour follows and can be rewatched.</p>
<p><strong>Status:</strong> built in the prototype.</p>`;

const APP_DOC_GOALS = `<h2>Daily Goals</h2>
<p>Goals are specific, useful and within the person's control. They replaced "small promises" because a missed goal should not feel like a broken promise. Completion can become evidence, never a perfection score.</p>
${table(['Situation', 'Example Daily Goal'], [
  ['Easy run', '"I will keep the whole run at my prescribed easy effort."'],
  ['Injury', '"I will complete the rehab prescribed today without adding extra."'],
  ['Running anxiety', '"I will put my kit on and step outside, then decide what comes next."'],
  ['Rest day', '"I will take my planned rest day without adding an unplanned run."'],
  ['Everyday life', '"I will put my phone away while I eat dinner."'],
])}
<p>Goal banks exist for Injured, Everyday, Returning From Injury, Running With Anxiety, Marathon, Ultra, and for Easy, Quality, Long and Rest/Recovery days. Previous choices reappear for the same kind of day; users add, remove or edit them. AI may suggest a more actionable version of an outcome — the user decides, and goals are never changed silently.</p>`;

const APP_DOC_BANK = `<h2>Confidence Bank™</h2>
<p><em>Stop waiting to feel confident. Start collecting the evidence.</em></p>
<p>Bank a Moment after a run, a rehab session, a decision, a difficult conversation, a rest day respected, or anything handled differently. Big or small, if it matters, it counts. What gets banked is the user's own experience — never the motivational message that prompted it.</p>
<h3>Entry design</h3>
${list([
  'One text box; the prompt stays visible while typing.',
  'Prompts by day type: running day, strength day, rest day, injury/rehab day, poorly day, everyday life.',
  'Tags as tiles: 8–12 common/recent tags, autocomplete, and "+ Add" for personal tags. User-facing tags are kept separate from the standard tags used for analysis.',
  'Backdating, so earlier achievements can be banked.',
  'Quiet classification into the seven areas.',
])}
<h3>Prediction versus reality</h3>
<p>Before: "I don't think I can finish this session." After: "I completed all six reps." Runmora asks what that says about how well pre-run confidence predicted the outcome, and lets the person reach their own conclusion.</p>
<p><strong>Status:</strong> built in the prototype, including revisit mode and race-day reviews.</p>`;

const APP_DOC_TOOLS = `<h2>Tools and Reframe</h2>
<p>Runmora shouldn't ask "Which mindset tool would you like?" when someone is struggling. It asks what is happening, then routes them to the right tool.</p>
${table(['What someone is thinking', 'Runmora routes to'], [
  ['"One bad run means I\'m not ready."', 'Evidence Challenge / Reframe'],
  ['"I used to be faster."', 'Past Me — the fair comparison check'],
  ['"Everyone else is getting faster."', 'Back to My Lane'],
  ['"It\'s a fact that I\'ll fail."', 'Fact or Story'],
  ['"I\'m spiralling."', 'STEADY — Stop, Take a breath, Examine, Aim small, Do that, Your evidence'],
  ['"I\'m having a wobble mid-run."', 'Wobble — relax shoulders, long exhale, next 100 m'],
  ['"I\'m injured and going nowhere."', 'Still Moving Forward'],
  ['"Race week nerves."', 'Race Ready — evidence, controllables, problem rehearsal'],
])}
<h3>Reframe rules</h3>
${list([
  'Acknowledge when something genuinely was difficult — never "replace a negative thought with a positive one".',
  'Separate what happened from the interpretation, look at relevant evidence (check-ins, Daily Goals, Bank entries, previous reframes), then offer a fairer interpretation.',
  'The user can try another approach, and bank the reframe if it helped.',
])}
<p><strong>Status:</strong> Reframe and the guided tools are built in the prototype.</p>`;

const APP_DOC_REFLECTION = `<h2>Reflection &amp; Recovery</h2>
<p>Check-ins, goals and banked moments capture the details. Reflection helps people zoom out.</p>
${list([
  '<strong>Month 1:</strong> notice what happened.',
  '<strong>Month 2:</strong> understand what helped.',
  '<strong>Month 3:</strong> recognise change.',
  '<strong>Month 4:</strong> look at the evidence — "I now know I can…", "I have evidence that…".',
  '<strong>After month 4:</strong> a blend of consistent questions, the curated Runmora question bank, and carefully selected personal questions. AI never invents a random journal prompt.',
])}
<p>Question sets exist for runners, everyday life, strength &amp; conditioning, injured runners (fortnightly blocks over eight weeks) and returning runners.</p>`;

const APP_DOC_MESSAGES = `<h2>Weekly messages and opening quotes</h2>
${table(['Day', 'Message'], [
  ['Monday', 'Mindset'],
  ['Thursday', 'Top Tips'],
  ['Saturday', 'Motivation'],
  ['Sunday', 'Reflection'],
])}
<p>Each message type is optional and selectable on its own. Banks of 52 messages per type exist for runners and for everyday life, tagged by theme (confidence, setbacks, comparison, injury, race mindset, recovery…). A message can offer Bank a Moment when it sparks a memory — it should never turn into homework.</p>
<p><strong>Opening quote:</strong> a short quote before the first check-in of the day, chosen by context — e.g. returning from injury → patience and identity; recent comparison → "Different circumstances deserve different expectations."; race week → "Confidence isn't knowing it'll go well. It's knowing you can handle it if it doesn't."</p>`;

const APP_DOC_AI = `<h2>AI principles</h2>
${list([
  'Personalisation depends on input. Runmora must not claim to understand someone on day one.',
  'Explain the benefit before the technology: "Runmora remembers what you forget", not "AI-powered insights".',
  'Surface the person\'s actual evidence; never invent encouragement.',
  'Suggest, never silently change, a user\'s goals or words.',
  'The Runmora Guide supports reflection; a human coach provides coaching. Keep the two distinct.',
  'Training questions go to coaching; nutrition concerns to a qualified professional; safety concerns to an emergency hand-off.',
])}
<h3>Data to keep for each reframe</h3>
<p>timestamp, original text, method selected, context used, goals and Bank entries referenced, check-in state, whether it helped, whether another approach was requested, whether it was banked.</p>`;

const APP_DOC_BRAND = `<h2>Brand and voice</h2>
<p>Encouraging, welcoming, supportive — and grounded. Running is about confidence, personal growth and wellbeing, not just performance. Avoid false positivity, guilt, comparison and claims that every difficult experience was secretly a success.</p>
<h3>What we left out</h3>
<p>No streaks. No badges. No leaderboards. No pace comparisons. No kudos counts. <em>No streaks. No guilt. Just the support you choose.</em></p>
<h3>Lines worth keeping</h3>
${list([
  'Confidence comes from evidence.',
  'Build it when you can. Bank it as you go. Lean on it when you need it.',
  'One run is information. It isn\'t a verdict.',
  'Your confidence can wobble. Your evidence doesn\'t disappear.',
  'Runmora is there for the wobbles, too.',
])}
${DOC_REBRAND_NOTE}`;

const APP_DOC_ROADMAP = `<h2>Future roadmap</h2>
<p>To consider after the MVP, once launch scope is confirmed:</p>
${list([
  'Coach overview / coach dashboard (Rachael\'s question: can a coach get an overview?)',
  'Running community',
  'Strava and wearable integrations',
  'Readiness and recovery score',
  'Comparison journal ("Your comparison patterns") and deeper exercises such as the Past Me Letter',
  'Learning platform built from the mindset video library',
])}`;

const APP_DOC_STATUS = `<h2>Current status — prototype inventory</h2>
<p>As of 2 Oct 2026. Repo: <code>Rungevity</code> (Flutter), 4 commits between 29 and 30 Sep 2026, about 24.5k lines of Dart, 74 tests.</p>
${table(['Area', 'Status', 'Notes'], [
  ['Onboarding, setup, quick tour', 'Done', 'Focus and support areas, first check-in, goal and Bank entry'],
  ['Home recommendations', 'Done', 'Rules engine by check-in state and situation'],
  ['Mood check-in', 'Done', 'Two feelings, injured/poorly, kind of day, timestamped'],
  ['Daily Goals', 'Done', 'Kinds of day, outcome→action, usual week'],
  ['Confidence Bank', 'Done', 'Prompts, tags, backdating, classifier, revisit'],
  ['Tools and Reframe', 'Done', 'About 12 scripted tools'],
  ['Breathwork, mindset library, blog', 'Done', 'Placeholder audio and sample videos'],
  ['Reflection &amp; Recovery', 'Done', 'Monthly blocks'],
  ['Weekly messages', 'Done (local)', '318 messages, local notifications'],
  ['Progress', 'Done', 'Mood grid, weekly moments, AI weekly reflection'],
  ['Talk / Runmora Guide', 'Partial', 'Coach messaging stored on device only'],
  ['Paywall', 'UI only', 'Purchase simulated'],
  ['Accounts', 'Prototype', 'Fake login stored on device'],
  ['AI', 'Prototype', 'Gemini called from the app — key must move server-side'],
  ['Backend, database', 'Not started', ''],
  ['Firebase, push, payments, analytics', 'Not started', 'Analytics events defined, console only'],
  ['Store release', 'Not started', 'Debug signing; ids still com.rungevity.rungevity'],
])}`;

const APP_DOC_TECH = `<h2>Technology</h2>
<h3>Prototype (built)</h3>
${list([
  '<strong>App:</strong> Flutter 3.44, Dart 3.12 — Riverpod for state, go_router for navigation.',
  '<strong>Storage:</strong> on-device Hive; content bundled as JSON.',
  '<strong>Audio:</strong> just_audio with background playback and lock-screen controls.',
  '<strong>Notifications:</strong> local, scheduled with time zones.',
  '<strong>AI:</strong> Gemini, called from the device in the prototype.',
])}
<h3>MVP (planned)</h3>
${list([
  '<strong>Backend:</strong> Node.js and REST APIs.',
  '<strong>Database:</strong> PostgreSQL.',
  '<strong>Authentication and push:</strong> Firebase Auth and FCM.',
  '<strong>Payments:</strong> App Store and Google Play in-app subscriptions with server-side entitlements. Stripe only for web purchases — the stores reject it for in-app digital subscriptions.',
  '<strong>AI:</strong> behind the API, with guardrails and usage limits.',
])}`;

const APP_DOC_TIMELINE = `<h2>Timeline</h2>
${table(['Milestone', 'Due', 'Status'], APP_MILESTONES.map((m) => [m.title, m.due, m.status === 'DONE' ? 'Done' : m.status === 'IN_PROGRESS' ? 'In progress' : 'Planned']))}
<p>Dates after the rebrand are estimates and depend on the launch scope Rachael and Jason confirm.</p>`;

const APP_DOC_REBRAND = `<h2>Rebrand checklist — Rungevity → Runmora (app)</h2>
<p>273 occurrences of the old name across 67 files when the rebrand started.</p>
${table(['Item', 'Where', 'Notes'], [
  ['User-facing copy and AI prompts', 'lib/ (≈126)', 'Onboarding, setup, Talk, notifications, profile'],
  ['Bundled content', 'assets/content (33)', 'Authors "The Rungevity team"'],
  ['Dart package and imports', 'pubspec + 64 imports', 'rungevity → runmora'],
  ['Class names', 'RungevityApp, RungevityAudioHandler, RungevityMessage', ''],
  ['App id / bundle id', 'Android, iOS', 'Decide before first store upload'],
  ['App labels and display names', 'AndroidManifest, Info.plist, AppConfig.appName', ''],
  ['Notification channels', 'rungevity_messages', 'Changing the id resets user channel settings — do it before launch'],
  ['Docs and files', 'README, PROTOTYPE_PLAN, .iml, APK name, repo folder', ''],
])}`;

const APP_DOC_RISKS = `<h2>Release checklist and risks</h2>
<h3>Risks</h3>
${list([
  '<strong>API key in the APK.</strong> The prototype bundles .env, so the Gemini key shipped in the shared APK. Rotate it and move AI calls behind the API.',
  '<strong>App identity.</strong> The bundle id cannot change after the first store upload.',
  '<strong>Claims vs scope.</strong> Landing-page claims must match the confirmed launch scope.',
  '<strong>Wellbeing safety.</strong> Keep the Guide distinct from coaching and medical advice; keep the emergency hand-off.',
])}
<h3>Before submission</h3>
${list([
  'Release keystore and iOS team / provisioning',
  'Privacy policy and data-safety declarations',
  'Store listings and screenshots with final brand',
  'Regression pass on the device matrix',
])}`;

const APP_DOCS: DocSeed[] = [
  { title: 'Project brief', icon: '📄', kind: 'PAGE', html: APP_DOC_BRIEF },
  {
    title: 'Product',
    icon: '🎯',
    kind: 'FOLDER',
    children: [
      { title: 'The Runmora loop', icon: '🔁', kind: 'PAGE', html: APP_DOC_LOOP },
      { title: 'Onboarding and first run', icon: '👋', kind: 'PAGE', html: APP_DOC_ONBOARDING },
      { title: 'Daily Goals', icon: '✅', kind: 'PAGE', html: APP_DOC_GOALS },
      { title: 'Confidence Bank', icon: '💰', kind: 'PAGE', html: APP_DOC_BANK },
      { title: 'Tools and Reframe', icon: '🧰', kind: 'PAGE', html: APP_DOC_TOOLS },
      { title: 'Reflection & Recovery', icon: '🪞', kind: 'PAGE', html: APP_DOC_REFLECTION },
      { title: 'Weekly messages and quotes', icon: '📬', kind: 'PAGE', html: APP_DOC_MESSAGES },
      { title: 'AI principles', icon: '🤖', kind: 'PAGE', html: APP_DOC_AI },
      { title: 'Brand and voice', icon: '🎨', kind: 'PAGE', html: APP_DOC_BRAND },
      { title: 'Future roadmap', icon: '🧭', kind: 'PAGE', html: APP_DOC_ROADMAP },
    ],
  },
  {
    title: 'Delivery',
    icon: '🚀',
    kind: 'FOLDER',
    children: [
      { title: 'Current status', icon: '📊', kind: 'PAGE', html: APP_DOC_STATUS },
      { title: 'Technology', icon: '🔧', kind: 'PAGE', html: APP_DOC_TECH },
      { title: 'Timeline', icon: '🗓️', kind: 'PAGE', html: APP_DOC_TIMELINE },
      { title: 'Rebrand checklist', icon: '🏷️', kind: 'PAGE', html: APP_DOC_REBRAND },
      { title: 'Release checklist and risks', icon: '⚠️', kind: 'PAGE', html: APP_DOC_RISKS },
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

// ═══════════════════════════════════════════════════════════════════════════════
// Project 2 — Landing page
// ═══════════════════════════════════════════════════════════════════════════════

const WEB_MILESTONES: MilestoneSeed[] = [
  { title: 'First build and Hostinger deploy', description: 'Single-page five-kilometre journey, sticky header and mobile menu, Hostinger build fixes.', due: '2026-09-25', status: 'DONE' },
  { title: 'Rewrite to the Sep 2026 brief', description: 'One story — the wobbles, a daily check-in, banking evidence, leaning on it. New problem, injury and beyond-running sections.', due: '2026-09-29', status: 'DONE' },
  { title: 'Align with the App Ideas document', description: 'Story order, real monthly reflection questions, survey wording, Everyday goal type.', due: '2026-09-29', status: 'DONE' },
  { title: 'Runmora rebrand', description: 'Every Rungevity mention, the title, the package name and survey source labels.', due: '2026-10-09', status: 'IN_PROGRESS' },
  { title: 'Waitlist live', description: 'Working waitlist with a privacy notice, legal pages, SEO metadata and analytics.', due: '2026-10-23', status: 'PENDING' },
  { title: 'Claims and figures signed off', description: 'Survey figures verified against the export; every feature claim matches the confirmed launch scope.', due: '2026-10-30', status: 'PENDING' },
];

const WEB_TASKS: TaskSeed[] = [
  // ── Build ─────────────────────────────────────────────────────────────────
  { title: 'Next.js 16 project setup', description: 'App Router, TypeScript, Tailwind CSS v4 with the pine/chalk/amber/sage palette, Bricolage Grotesque, Manrope and Geist Mono.', label: 'web', status: 'DONE', priority: 'HIGH', owner: 'lead', milestone: 0, doneOn: '2026-09-25' },
  { title: 'Five-kilometre page journey', description: 'Single page told as a 5K, with a km split on each section, "km read" progress and a track bar in the header.', label: 'web', status: 'DONE', priority: 'HIGH', owner: 'lead', milestone: 0, doneOn: '2026-09-25' },
  { title: 'Sticky header and mobile menu', description: 'Solid header outside the hero; full-screen accessible mobile menu that closes on link tap, Escape or resize.', label: 'web', status: 'DONE', priority: 'MEDIUM', owner: 'lead', milestone: 0, doneOn: '2026-09-25' },
  { title: 'Deploy to Hostinger', description: 'pnpm 10 lockfile, Next pinned to 16.1.6 for the older server, webpack build with one worker because Hostinger kills Turbopack\'s PostCSS process.', label: 'launch', status: 'DONE', priority: 'HIGH', owner: 'lead', milestone: 0, doneOn: '2026-09-29' },
  { title: 'Hero: "Confidence comes from evidence."', description: 'Lane graphic, phone mockup, tagline row, commitment line and "Coming to iOS and Android". Join the waitlist as the main action.', label: 'web', status: 'DONE', priority: 'HIGH', owner: 'lead', milestone: 1, doneOn: '2026-09-29' },
  { title: 'Problem section: the wobbles', description: 'Start line, bad run, injury and comparison questions; watch data vs what you told yourself; three survey figures.', label: 'web', status: 'DONE', priority: 'HIGH', owner: 'lead', milestone: 1, doneOn: '2026-09-29' },
  { title: 'How it works: five connected steps', description: 'Check in → Focus on today → Use support when useful → Bank what matters → See your evidence over time. Replaced the six-step routine.', label: 'web', status: 'DONE', priority: 'HIGH', owner: 'lead', milestone: 1, doneOn: '2026-09-29' },
  { title: 'Daily Goals section', description: 'Tabs by kind of day, goal checklist, and a demo of turning an outcome into an action. Replaced "small promises".', label: 'web', status: 'DONE', priority: 'HIGH', owner: 'lead', milestone: 1, doneOn: '2026-09-29' },
  { title: 'Breathing demo', description: 'Interactive breathing-pattern demo with accessible controls.', label: 'web', status: 'DONE', priority: 'LOW', owner: 'lead', milestone: 0, doneOn: '2026-09-25' },
  { title: 'Confidence Bank centrepiece', description: 'Bank a Moment deposit cards, CTA, and the prediction-vs-reality demo.', label: 'web', status: 'DONE', priority: 'URGENT', owner: 'lead', milestone: 1, doneOn: '2026-09-29' },
  { title: 'Reflection and weekly rhythm', description: 'Months 1–4 with the real reflection questions, then "After month 4"; Monday / Thursday / Saturday / Sunday, each optional.', label: 'web', status: 'DONE', priority: 'MEDIUM', owner: 'lead', milestone: 2, doneOn: '2026-09-29' },
  { title: 'Tools: "When doubt arrives"', description: 'Reframe, Past Me Comparison and "Show me my evidence", each introduced by the thought it answers; Guide mockup, distinct from a coach.', label: 'web', status: 'DONE', priority: 'MEDIUM', owner: 'lead', milestone: 1, doneOn: '2026-09-29' },
  { title: 'Injury and illness section', description: '"When you can\'t run, your evidence still matters." Injured respondent figures (n=49).', label: 'web', status: 'DONE', priority: 'HIGH', owner: 'lead', milestone: 1, doneOn: '2026-09-29' },
  { title: 'Beyond running section', description: 'Built for running, useful beyond it: strength, recovery, cycling and everyday life.', label: 'web', status: 'DONE', priority: 'MEDIUM', owner: 'lead', milestone: 1, doneOn: '2026-09-29' },
  { title: 'What we left out', description: 'No streaks. No badges. No leaderboards. No pace comparisons. No kudos counts.', label: 'web', status: 'DONE', priority: 'LOW', owner: 'lead', milestone: 0, doneOn: '2026-09-25' },
  { title: 'Align page with the App Ideas document', description: 'Story reordered to bank → reflection → tools → injury; real reflection questions; survey wording; Everyday goal type.', label: 'content', status: 'DONE', priority: 'HIGH', owner: 'lead', milestone: 2, doneOn: '2026-09-29' },
  { title: 'Accessibility basics and reduced motion', description: 'ARIA roles on interactive demos, labelled email field, status message, decorative SVGs hidden, prefers-reduced-motion support; CSS reveals work without JavaScript.', label: 'qa', status: 'DONE', priority: 'MEDIUM', owner: 'lead', milestone: 1, doneOn: '2026-09-29' },

  // ── Review ────────────────────────────────────────────────────────────────
  { title: 'Review the page against the brief', description: 'Rachael and Jason read the live page against the landing-page brief: story order, tone, "mindset support in your pocket", no pricing.', label: 'content', status: 'IN_REVIEW', priority: 'HIGH', owner: 'rachel', milestone: 3 },

  // ── Rebrand ───────────────────────────────────────────────────────────────
  { title: 'Rebrand the site to Runmora', description: '33 lines across 17 files: copy in 13 components (wordmark, finish, footer, guide, rhythm…), the page title, survey source labels and the "question bank" line in content.ts, package name.', label: 'rebrand', status: 'IN_PROGRESS', priority: 'URGENT', owner: 'lead', milestone: 3 },
  { title: 'Final logo, favicon and app icons', description: 'Replace the placeholder BrandMark and the default favicon; add apple-icon and a manifest. Depends on the final Runmora logo.', label: 'design', status: 'TODO', priority: 'HIGH', owner: 'lead', milestone: 4 },
  { title: 'Rename the repository', description: 'rungevityweb → runmora web, and update the Hostinger deployment source.', label: 'rebrand', status: 'TODO', priority: 'LOW', owner: 'lead', milestone: 3 },

  // ── Waitlist and legal ────────────────────────────────────────────────────
  { title: 'Connect the waitlist form', description: 'The form only validates the email and shows "You\'re on the list" — nothing is stored. Send sign-ups to a real list (or straight into this CRM as leads), with double opt-in, spam protection and real success/error states.', label: 'web', status: 'TODO', priority: 'URGENT', owner: 'lead', milestone: 4 },
  { title: 'Privacy notice and terms pages', description: 'The waitlist promises "unsubscribe at any time" but there is no privacy notice. Add pages and link them from the form and footer.', label: 'launch', status: 'TODO', priority: 'URGENT', owner: 'jason', milestone: 4 },
  { title: 'Say what joining the waitlist means', description: 'The form should state what follow-up to expect and where the privacy notice is.', label: 'content', status: 'TODO', priority: 'MEDIUM', owner: 'rachel', milestone: 4 },
  { title: 'Connect the domain and SSL', description: 'No domain is configured in the code. Point the Runmora domain at Hostinger with SSL and set the canonical URL.', label: 'launch', status: 'TODO', priority: 'HIGH', owner: 'jason', milestone: 4 },

  // ── SEO and analytics ─────────────────────────────────────────────────────
  { title: 'Social and search metadata', description: 'OpenGraph and Twitter tags with an OG image, metadataBase and canonical URL, sitemap.ts and robots.ts.', label: 'seo', status: 'TODO', priority: 'HIGH', owner: 'lead', milestone: 4 },
  { title: 'Analytics and waitlist conversion', description: 'Privacy-friendly analytics with a waitlist sign-up event.', label: 'seo', status: 'TODO', priority: 'MEDIUM', owner: 'lead', milestone: 4 },

  // ── Sign-off ──────────────────────────────────────────────────────────────
  { title: 'Verify survey figures against the export', description: 'Check each figure, question wording, denominator and rounding against the original survey export before publishing (79%, 39%, 75% / 37%, and the injured n=49 figures). Source line: Runmora runner questionnaire, 2026, 75 respondents.', label: 'content', status: 'TODO', priority: 'URGENT', owner: 'rachel', milestone: 5 },
  { title: 'Confirm every feature claim on the page', description: 'Reframe, Past Me Comparison, "Show me my evidence", injured/poorly switching, personalised weekly messages, ongoing monthly questions — say "planned" or remove anything not in the launch release. No pricing until decided.', label: 'content', status: 'TODO', priority: 'HIGH', owner: 'jason', milestone: 5 },
  { title: 'Check use of the Confidence Bank™ mark', description: 'Confirm the ™ is appropriate before public launch.', label: 'launch', status: 'BACKLOG', priority: 'LOW', owner: 'jason', milestone: 5 },

  // ── Later ─────────────────────────────────────────────────────────────────
  { title: 'Footer links', description: 'Contact, socials and legal pages; the footer has no links today.', label: 'web', status: 'BACKLOG', priority: 'MEDIUM', owner: 'lead', milestone: 4 },
  { title: 'Lighthouse and accessibility pass', description: 'Add a skip link; check contrast, focus order and performance on mobile.', label: 'qa', status: 'BACKLOG', priority: 'MEDIUM', owner: 'lead', milestone: 5 },
  { title: 'FAQ section', description: 'Only if the page needs it after review.', label: 'content', status: 'BACKLOG', priority: 'LOW', owner: 'rachel', milestone: 5 },
  { title: 'Replace the boilerplate README and unused files', description: 'Real setup and Hostinger deploy notes; remove the unused create-next-app SVGs.', label: 'web', status: 'BACKLOG', priority: 'LOW', owner: 'lead', milestone: 5 },
  { title: 'App Store and Google Play badges at launch', description: 'Swap "Join the waitlist" for store badges when the app is live.', label: 'launch', status: 'BACKLOG', priority: 'LOW', owner: 'lead', milestone: 5 },
];

const WEB_DOC_BRIEF = `<h2>Runmora landing page</h2>
${MAIN_MESSAGE}
<p>The landing page tells one clear story and collects waitlist sign-ups ahead of the app launch: people build evidence of what they can do through small actions and reflection, then draw on it when race nerves, setbacks, injury or illness shake their confidence.</p>
<h2>The story the page follows</h2>
<ol>
<li>I recognise this problem — a start-line wobble, a bad run, comparison or injury.</li>
<li>I can start small — check in and choose one useful Daily Goal.</li>
<li>I collect what happened — Bank a Moment in my own words.</li>
<li>I begin to see patterns — weekly and monthly reflection.</li>
<li>I can use it when I need it — Runmora brings relevant evidence and tools back in a difficult moment.</li>
</ol>
<h2>Where we are (2 Oct 2026)</h2>
${list([
  'The full page is built, deployed on Hostinger, and rewritten to the brief and the App Ideas document (29 Sep).',
  'The Runmora rebrand is in progress.',
  'Not launch-ready yet: the waitlist form stores nothing, and there is no privacy notice, SEO metadata or analytics.',
])}`;

const WEB_DOC_STRUCTURE = `<h2>Page structure</h2>
<p>One route, told as a five-kilometre run.</p>
${table(['km', 'Section', 'Status'], [
  ['0.00', 'Hero — Confidence comes from evidence', 'Done'],
  ['0.40', 'The wobbles — problem and survey figures', 'Done'],
  ['1.00', 'How it works — five steps', 'Done'],
  ['1.50', 'Daily Goals', 'Done'],
  ['2.00', 'Support — breathing demo', 'Done'],
  ['2.50', 'Confidence Bank — Bank a Moment, prediction vs reality', 'Done'],
  ['3.00', 'Zoom out — reflection and weekly rhythm', 'Done'],
  ['3.50', 'When doubt arrives — tools and the Guide', 'Done'],
  ['4.00', 'Injury and illness', 'Done'],
  ['4.40', 'Beyond running', 'Done'],
  ['4.70', 'What we left out', 'Done'],
  ['5.00', 'Finish — join the waitlist', 'Form not connected'],
  ['—', 'Footer', 'No links yet'],
  ['—', 'Privacy and terms pages', 'Missing'],
])}
<p>CTAs: near the hero, after the Confidence Bank, and at the finish — always "Join the waitlist".</p>`;

const WEB_DOC_COPY = `<h2>Copy brief</h2>
<p>From the landing-page brief in the App Ideas document. The copy there is source material; the live page should stay easy to scan.</p>
${list([
  '<strong>Hero:</strong> "Confidence comes from evidence. The mindset app built around your evidence." Main button Join the waitlist; secondary See how it works. "Start with one check-in a day."',
  '<strong>Problem first:</strong> "Ever stood on a race start line and suddenly doubted yourself?" — "These are the moments Runmora is built for."',
  '<strong>Lighter daily experience:</strong> "One small check-in. A bigger picture over time." Never a compulsory checklist.',
  '<strong>Daily Goals, not promises:</strong> specific, useful, in the person\'s control; one is enough.',
  '<strong>Confidence Bank at the centre:</strong> "Stop waiting to feel confident. Start collecting the evidence."',
  '<strong>Prediction vs reality:</strong> show before and after side by side; let the visitor conclude.',
  '<strong>Tools through the problem they solve,</strong> not feature names. Reframe never means "replace a negative thought with a positive one".',
  '<strong>Injury and illness:</strong> "\'I\'m not running\' doesn\'t mean \'I\'m doing nothing.\'"',
  '<strong>Reflection grows with the user:</strong> months 1–4, then a blend of set and personal questions.',
  '<strong>Weekly rhythm:</strong> Monday Mindset, Thursday Top Tips, Saturday Motivation, Sunday Reflection — each optional. "Mindset support in your pocket", not "a coach in your pocket".',
  '<strong>Beyond running:</strong> "Built for running. Useful beyond it."',
  '<strong>Close:</strong> "Runmora won\'t tell you that you should feel confident. It will help you see the evidence you\'ve already given yourself."',
])}
<h3>Presentation rules</h3>
${list([
  'Phone first; one clear point per section; short example cards.',
  'Keep the contrast between what a watch recorded and what happened in someone\'s head.',
  '"Runmora remembers what you forget" beats "AI-powered insights".',
  'No pricing or free-vs-premium split until decided.',
  'Use the exact Runmora logo and brand colours.',
])}`;

const WEB_DOC_SURVEY = `<h2>Survey figures</h2>
<p>Source line on the page: <em>Runmora runner questionnaire, 2026 · 75 respondents</em> (run as the Rungevity questionnaire). Use only the figures that support the story.</p>
${table(['Finding', 'Figure', 'Base'], SURVEY_ROWS)}
<p><strong>Publication check:</strong> these numbers came from discussion of the questionnaire. Verify each figure, the question wording, the denominator and the rounding against the original survey export before publishing. Label injured figures with their base (n=49).</p>`;

const WEB_DOC_CLAIMS = `<h2>Feature claims to confirm</h2>
<p>Confirm with Rachael and Jason before publishing. If a feature is planned, say so clearly or leave it off the page.</p>
${table(['Claim', 'In the app prototype?', 'On the page?'], [
  ['Reframe', 'Yes', 'Yes'],
  ['Past Me Comparison', 'Yes', 'Yes'],
  ['"Show me my evidence" retrieval', 'Partly (Remember this?, revisit)', 'Yes'],
  ['Injured / poorly status switching', 'Yes', 'Yes'],
  ['Personalised weekly messages', 'Yes (local)', 'Yes'],
  ['Ongoing personalised monthly questions', 'Months 1–4 built', 'Yes'],
  ['Community', 'No', 'Removed'],
  ['Human coach access', 'Device-only stub', 'Removed'],
  ['Integrations', 'No', 'No'],
  ['Pricing / premium content', 'Placeholder paywall', 'Removed'],
])}`;

const WEB_DOC_TECH = `<h2>Build and hosting</h2>
${list([
  '<strong>Stack:</strong> Next.js 16.1.6 (App Router), React 19, TypeScript, Tailwind CSS v4, pnpm 10.',
  '<strong>Hosting:</strong> Hostinger Node hosting, deployed from GitHub.',
  '<strong>Hostinger quirks:</strong> Next is pinned to 16.1.6 for the older server; builds use <code>next build --webpack</code> with <code>experimental.cpus: 1</code> because Hostinger kills Turbopack\'s separate PostCSS process; pnpm 10 lockfile.',
  '<strong>Content:</strong> all copy lives in <code>app/content.ts</code>.',
  '<strong>Assets:</strong> SVG and CSS only — no raster images; reveal animations use CSS scroll timelines with reduced-motion support.',
  '<strong>Backend:</strong> none yet — the waitlist needs one.',
])}`;

const WEB_DOC_LAUNCH = `<h2>Launch checklist</h2>
${list([
  'Runmora rebrand complete (copy, title, package, survey label)',
  'Final logo, favicon, apple icon, manifest',
  'Waitlist stores sign-ups, with double opt-in and spam protection',
  'Privacy notice and terms, linked from the form and footer',
  'Domain and SSL, canonical URL',
  'OpenGraph / Twitter metadata, OG image, sitemap, robots',
  'Analytics with a waitlist conversion event',
  'Survey figures verified; feature claims confirmed',
  'Mobile review and Lighthouse pass',
])}
${DOC_REBRAND_NOTE}`;

const WEB_DOCS: DocSeed[] = [
  { title: 'Project brief', icon: '📄', kind: 'PAGE', html: WEB_DOC_BRIEF },
  {
    title: 'Page',
    icon: '🖥️',
    kind: 'FOLDER',
    children: [
      { title: 'Page structure', icon: '🧱', kind: 'PAGE', html: WEB_DOC_STRUCTURE },
      { title: 'Copy brief', icon: '✍️', kind: 'PAGE', html: WEB_DOC_COPY },
      { title: 'Survey figures', icon: '📈', kind: 'PAGE', html: WEB_DOC_SURVEY },
      { title: 'Feature claims to confirm', icon: '☑️', kind: 'PAGE', html: WEB_DOC_CLAIMS },
    ],
  },
  {
    title: 'Delivery',
    icon: '🚀',
    kind: 'FOLDER',
    children: [
      { title: 'Build and hosting', icon: '🔧', kind: 'PAGE', html: WEB_DOC_TECH },
      { title: 'Launch checklist', icon: '🏁', kind: 'PAGE', html: WEB_DOC_LAUNCH },
    ],
  },
  {
    title: 'Team',
    icon: '🤝',
    kind: 'FOLDER',
    children: [{ title: 'Team roles', icon: '📌', kind: 'PAGE', html: DOC_TEAM }],
  },
];

const PROJECTS: ProjectSeed[] = [
  {
    name: 'Runmora – Mobile App',
    description:
      'Take the Runmora app (formerly Rungevity) from a working Flutter prototype to a launched MVP on iOS and Android: rebrand, backend and accounts, subscriptions, final content and brand, beta and store launch.',
    projectType: 'other',
    start: '2026-09-17',
    milestones: APP_MILESTONES,
    tasks: APP_TASKS,
    docs: APP_DOCS,
  },
  {
    name: 'Runmora – Landing Page',
    description:
      'The Runmora waitlist site: a single-page five-kilometre story that turns "Confidence comes from evidence" into waitlist sign-ups ahead of the app launch.',
    projectType: 'website',
    start: '2026-09-25',
    milestones: WEB_MILESTONES,
    tasks: WEB_TASKS,
    docs: WEB_DOCS,
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// Seeding
// ═══════════════════════════════════════════════════════════════════════════════

type Member = { id: string; name: string | null; email: string };

async function workspaceMembers(companyId: string): Promise<Member[]> {
  const rows = await prisma.userCompany.findMany({
    where: { companyId },
    select: { user: { select: { id: true, name: true, email: true } } },
  });
  return rows.map((r: { user: Member }) => r.user);
}

/** Find a teammate by email (env) or by first name among the workspace's members. */
async function findTeammate(members: Member[], envKey: string, firstName: string): Promise<Member | null> {
  const email = process.env[envKey]?.trim().toLowerCase();
  if (email) {
    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true, name: true, email: true },
    });
    if (!user) throw new Error(`${envKey} ${email} does not match an existing user`);
    return user;
  }
  const pattern = new RegExp(`^${firstName}`, 'i');
  return members.find((m) => m.name && pattern.test(m.name)) ?? null;
}

async function joinWorkspace(userId: string, companyId: string) {
  await prisma.userCompany.upsert({
    where: { userId_companyId: { userId, companyId } },
    create: { userId, companyId },
    update: {},
  });
}

/** True when a project holds nothing a person added — only what a seed created. */
async function isSeedOnly(projectId: string) {
  const [comments, worklogs, activity, attachments] = await Promise.all([
    prisma.projectTaskComment.count({ where: { task: { projectId } } }),
    prisma.projectTaskWorklog.count({ where: { task: { projectId } } }),
    prisma.projectTaskActivity.count({ where: { task: { projectId }, eventType: { not: 'CREATED' } } }),
    prisma.projectTaskAttachment.count({ where: { task: { projectId } } }),
  ]);
  return comments + worklogs + activity + attachments === 0;
}

async function seedProject(
  seed: ProjectSeed,
  companyId: string,
  team: Record<'lead' | 'rachel' | 'jason', Member | null>,
  labelIds: Record<LabelKey, string>
) {
  const lead = team.lead!;

  const existing = await prisma.project.findFirst({ where: { companyId, name: seed.name } });
  if (existing && !FORCE) {
    console.log(`Project "${seed.name}" already exists (${existing.id}) — re-run with --force to rebuild it.`);
    return;
  }
  if (existing) {
    await prisma.project.delete({ where: { id: existing.id } }); // cascades tasks, milestones, docs, members
    console.log(`Removed existing "${seed.name}" (--force)`);
  }

  const now = new Date();
  const project = await prisma.project.create({
    data: {
      name: seed.name,
      description: seed.description,
      status: 'ACTIVE',
      projectType: seed.projectType,
      progress: 0,
      startDate: day(seed.start),
      endDate: day(seed.milestones[seed.milestones.length - 1].due),
      companyId,
      pmUserId: lead.id,
      milestones: {
        create: seed.milestones.map((m, i) => ({
          title: m.title,
          description: m.description,
          status: m.status,
          dueDate: day(m.due),
          completedAt: m.status === 'DONE' ? day(m.due) : null,
          sortOrder: i,
        })),
      },
      members: {
        create: [
          { userId: lead.id, role: 'DEV' },
          ...(team.rachel ? [{ userId: team.rachel.id, role: 'PM' }] : []),
          ...(team.jason ? [{ userId: team.jason.id, role: 'OTHER' }] : []),
        ],
      },
    },
  });

  const sortByStatus: Record<string, number> = {};
  for (const task of seed.tasks) {
    const assignee = task.owner ? team[task.owner] : null;
    const due = day(seed.milestones[task.milestone].due);
    // Done work is dated from the repo history; open work was planned at project start.
    const createdAt = task.doneOn ? day(seed.start) : now;
    const sortOrder = (sortByStatus[task.status] = (sortByStatus[task.status] ?? -1) + 1);
    const leadName = lead.name || 'Lead';
    const activities: Array<{ actorId: string; eventType: string; description: string; createdAt: Date; metadata?: object }> = [
      { actorId: lead.id, eventType: 'CREATED', description: `${leadName} created this task`, createdAt },
    ];
    if (task.doneOn) {
      activities.push({
        actorId: lead.id,
        eventType: 'STATUS_CHANGED',
        description: `${leadName} changed status from IN_PROGRESS to DONE`,
        createdAt: day(task.doneOn),
        metadata: { from: 'IN_PROGRESS', to: 'DONE' },
      });
    }
    const created = await prisma.projectTask.create({
      data: {
        projectId: project.id,
        title: task.title,
        description: task.description,
        descriptionHtml: `<p>${esc(task.description)}</p>`,
        status: task.status,
        priority: task.priority,
        assigneeId: assignee?.id ?? null,
        reporterId: lead.id,
        dueDate: task.doneOn ? day(task.doneOn) : due,
        sortOrder,
        createdAt,
        labels: { create: { labelId: labelIds[task.label] } },
        watchers: { create: { userId: lead.id } },
        activities: { create: activities },
      },
    });
    if (assignee && assignee.id !== lead.id) {
      await prisma.projectTaskWatcher.create({ data: { taskId: created.id, userId: assignee.id } });
    }
  }

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
  await createDocs(seed.docs, null);

  const progress = computeProgressFromTasks(seed.tasks);
  await prisma.project.update({ where: { id: project.id }, data: { progress } });

  const counts: Record<string, number> = {};
  for (const t of seed.tasks) counts[t.status] = (counts[t.status] ?? 0) + 1;
  console.log(
    `Created "${seed.name}" (${project.id}): ${seed.milestones.length} milestones, ${seed.tasks.length} tasks ` +
      `(${Object.entries(counts).map(([s, n]) => `${n} ${s}`).join(', ')}), ${docCount} docs — ${progress}% done`
  );
  console.log(`  /${COMPANY.slug}/dashboard/projects/${project.id}`);
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
  const members = await workspaceMembers(companyId);
  const lead =
    (await findTeammate(members, 'RUNMORA_LEAD_EMAIL', 'Harshit')) ??
    (await prisma.user.findFirst({
      where: { role: 'ADMIN', userStatus: 'ACTIVE', name: { contains: 'Harshit', mode: 'insensitive' } },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, email: true },
    }));
  if (!lead) throw new Error('No project lead found — set RUNMORA_LEAD_EMAIL to an existing user');
  const rachel = await findTeammate(members, 'RUNMORA_RACHEL_EMAIL', 'Rach');
  const jason = await findTeammate(members, 'RUNMORA_JASON_EMAIL', 'Jason');
  for (const member of [lead, rachel, jason]) {
    if (member) await joinWorkspace(member.id, companyId);
  }
  console.log(
    `Team: ${lead.name} (lead)${rachel ? `, ${rachel.name}` : ''}${jason ? `, ${jason.name}` : ''}` +
      `${!rachel || !jason ? ' — missing teammates leave their tasks unassigned' : ''}`
  );
  const team = { lead, rachel, jason };

  // ── Earlier single-project seed ────────────────────────────────────────────
  const legacy = await prisma.project.findFirst({ where: { companyId, name: LEGACY_PROJECT_NAME } });
  if (legacy) {
    if (FORCE || (await isSeedOnly(legacy.id))) {
      await prisma.project.delete({ where: { id: legacy.id } });
      console.log(`Removed the earlier "${LEGACY_PROJECT_NAME}" project — replaced by the two projects below`);
    } else {
      throw new Error(
        `"${LEGACY_PROJECT_NAME}" has comments, worklogs or task changes. Move anything worth keeping, then re-run with --force.`
      );
    }
  }

  // ── Labels ─────────────────────────────────────────────────────────────────
  const labelIds = {} as Record<LabelKey, string>;
  for (const key of Object.keys(LABELS) as LabelKey[]) {
    const label = await prisma.projectLabel.upsert({
      where: { companyId_name: { companyId, name: LABELS[key].name } },
      create: { companyId, name: LABELS[key].name, color: LABELS[key].color },
      update: {},
    });
    labelIds[key] = label.id;
  }

  // ── Projects ───────────────────────────────────────────────────────────────
  for (const seed of PROJECTS) {
    await seedProject(seed, companyId, team, labelIds);
  }

  console.log('\nDone.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined);
  });
