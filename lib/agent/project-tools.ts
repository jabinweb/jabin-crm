import type { Session } from 'next-auth';
import { prisma } from '@/lib/prisma';
import type { AgentToolDef } from '@/lib/agent/tool-types';
import type { AgentRuntimeContext } from '@/lib/agent/context';
import { canWriteProjectDelivery } from '@/lib/projects/task-access';
import { createProjectTask } from '@/lib/projects/create-task';
import { updateProjectTask } from '@/lib/projects/update-task';
import { addProjectTaskComment } from '@/lib/projects/add-comment';
import { stripHtmlToPreview } from '@/lib/projects/task-activity';
import { isCompanyStaff } from '@/lib/projects/mentions';
import {
  getCompanyProjectTaskSettings,
  syncProjectProgress,
} from '@/lib/projects/sync-project-progress';
import { resolveDoneStatusIds, resolveProjectTaskColumns } from '@/lib/projects/task-statuses';
import { milestoneTemplatesFor } from '@/lib/projects/agency-delivery';
import { PROJECT_PRIORITIES } from '@/lib/projects/task-board';

/**
 * OPS agent tools for project delivery: projects, team, milestones, tasks, comments
 * and time. Writes go through the same functions as the UI (activity log,
 * notifications, progress) and the same access rules (canWriteProjectDelivery).
 */

const PROJECT_STATUSES = ['ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'];
const PROJECT_TYPES = ['website', 'webapp', 'seo', 'branding', 'retainer', 'other'];
const MILESTONE_STATUSES = ['PENDING', 'IN_PROGRESS', 'DONE'];
const PERSON = { select: { id: true, name: true, email: true } } as const;

/** The shared project write paths take a session; the agent acts as the signed-in user. */
function agentSession(ctx: AgentRuntimeContext): Session {
  return {
    user: { id: ctx.userId, name: ctx.userName, role: ctx.userRole, companyId: ctx.companyId },
    expires: new Date(Date.now() + 60_000).toISOString(),
  } as unknown as Session;
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

function personName(p: { name: string | null; email: string } | null | undefined) {
  return p ? p.name || p.email : null;
}

function day(d: Date | null | undefined) {
  return d ? d.toISOString().slice(0, 10) : null;
}

function parseDate(v: unknown, field: string): Date | undefined {
  const s = str(v);
  if (!s) return undefined;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid ${field}: ${s}`);
  return d;
}

/** Plain text from the model → safe rich text for task descriptions/comments. */
function textToHtml(text: string): string {
  const esc = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return esc
    .split(/\n{2,}/)
    .map((para) => `<p>${para.replace(/\n/g, '<br>')}</p>`)
    .join('');
}

const isProjectManager = (ctx: AgentRuntimeContext) =>
  ['SUPER_ADMIN', 'ADMIN', 'SALES'].includes(ctx.userRole);

async function findProject(ctx: AgentRuntimeContext, projectId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, companyId: ctx.companyId },
    select: { id: true, name: true },
  });
  if (!project) throw new Error('Project not found in this workspace');
  return project;
}

async function findTask(ctx: AgentRuntimeContext, taskId: string) {
  const task = await prisma.projectTask.findFirst({
    where: { id: taskId, project: { companyId: ctx.companyId } },
    select: { id: true, title: true, projectId: true },
  });
  if (!task) throw new Error('Task not found in this workspace');
  return task;
}

async function assertCanWrite(ctx: AgentRuntimeContext, projectId: string) {
  if (!(await canWriteProjectDelivery(agentSession(ctx), ctx.companyId, projectId))) {
    throw new Error('You can only change projects you lead or are a member of');
  }
}

function assertManager(ctx: AgentRuntimeContext) {
  if (!isProjectManager(ctx)) {
    throw new Error('Only admins and sales can change project settings, team and milestones');
  }
}

async function assertStaff(ctx: AgentRuntimeContext, userId: string) {
  if (!(await isCompanyStaff(ctx.companyId, userId))) {
    throw new Error('That person is not a member of this workspace');
  }
}

export const PROJECT_AGENT_TOOLS: AgentToolDef[] = [
  // ── Reads ────────────────────────────────────────────────────────────────
  {
    name: 'list_projects',
    description:
      'List delivery projects with status, progress, lead and task counts. Filter by status, name search, or only projects the user leads/is a member of.',
    kind: 'read',
    parameters: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'ACTIVE|ON_HOLD|COMPLETED|CANCELLED' },
        search: { type: 'string', description: 'Part of the project name' },
        mine: { type: 'boolean', description: 'Only projects the user leads or is on' },
      },
    },
    execute: async (args, ctx) => {
      const status = str(args.status)?.toUpperCase();
      const search = str(args.search);
      const projects = await prisma.project.findMany({
        where: {
          companyId: ctx.companyId,
          ...(status ? { status } : {}),
          ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
          ...(args.mine === true
            ? {
                OR: [
                  { pmUserId: ctx.userId },
                  { members: { some: { userId: ctx.userId } } },
                ],
              }
            : {}),
        },
        orderBy: { updatedAt: 'desc' },
        take: 25,
        select: {
          id: true,
          name: true,
          status: true,
          projectType: true,
          progress: true,
          endDate: true,
          pmUser: PERSON,
          customer: { select: { organizationName: true } },
          _count: { select: { tasks: true } },
        },
      });
      return {
        projects: projects.map((p) => ({
          id: p.id,
          name: p.name,
          status: p.status,
          type: p.projectType,
          progress: p.progress,
          due: day(p.endDate),
          lead: personName(p.pmUser),
          client: p.customer?.organizationName ?? null,
          tasks: p._count.tasks,
        })),
      };
    },
  },
  {
    name: 'get_project',
    description:
      'Full picture of one project: details, team, milestones, the board statuses, and its tasks (id, title, status, priority, assignee, due). Pass projectId, or name to look it up.',
    kind: 'read',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        name: { type: 'string', description: 'Project name (used when projectId is unknown)' },
      },
    },
    execute: async (args, ctx) => {
      let projectId = str(args.projectId);
      if (!projectId) {
        const name = str(args.name);
        if (!name) throw new Error('Pass projectId or name');
        const matches = await prisma.project.findMany({
          where: { companyId: ctx.companyId, name: { contains: name, mode: 'insensitive' } },
          select: { id: true, name: true, status: true },
          take: 5,
        });
        if (matches.length === 0) return { found: false, message: `No project matching “${name}”` };
        if (matches.length > 1) return { found: false, candidates: matches };
        projectId = matches[0].id;
      }

      const project = await prisma.project.findFirst({
        where: { id: projectId, companyId: ctx.companyId },
        include: {
          pmUser: PERSON,
          customer: { select: { id: true, organizationName: true } },
          members: { include: { user: PERSON } },
          milestones: { orderBy: { sortOrder: 'asc' } },
          tasks: {
            orderBy: [{ status: 'asc' }, { sortOrder: 'asc' }],
            take: 80,
            select: {
              id: true,
              title: true,
              status: true,
              priority: true,
              dueDate: true,
              parentTaskId: true,
              assignee: PERSON,
            },
          },
        },
      });
      if (!project) throw new Error('Project not found in this workspace');
      const settings = await getCompanyProjectTaskSettings(ctx.companyId);

      return {
        project: {
          id: project.id,
          name: project.name,
          description: project.description,
          status: project.status,
          type: project.projectType,
          progress: project.progress,
          start: day(project.startDate),
          due: day(project.endDate),
          budgetHours: project.budgetHours,
          client: project.customer,
          lead: project.pmUser
            ? { id: project.pmUser.id, name: personName(project.pmUser) }
            : null,
          members: project.members.map((m) => ({
            userId: m.user.id,
            name: personName(m.user),
            role: m.role,
          })),
        },
        boardStatuses: resolveProjectTaskColumns(settings).map((c) => ({
          id: c.id,
          label: c.label,
        })),
        milestones: project.milestones.map((m) => ({
          id: m.id,
          title: m.title,
          status: m.status,
          due: day(m.dueDate),
        })),
        tasks: project.tasks.map((t) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority,
          due: day(t.dueDate),
          assignee: t.assignee ? { id: t.assignee.id, name: personName(t.assignee) } : null,
          parentTaskId: t.parentTaskId,
        })),
      };
    },
  },
  {
    name: 'list_project_tasks',
    description:
      'Find project tasks across projects or within one: by status, assignee, "assigned to me", or overdue.',
    kind: 'read',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        status: { type: 'string', description: 'Board status id, e.g. TODO, IN_PROGRESS, DONE' },
        assigneeId: { type: 'string', description: 'userId from search_team_members (not employeeId)' },
        assignedToMe: { type: 'boolean' },
        overdue: { type: 'boolean', description: 'Past due and not done' },
      },
    },
    execute: async (args, ctx) => {
      const settings = await getCompanyProjectTaskSettings(ctx.companyId);
      const doneIds = resolveDoneStatusIds(settings);
      const projectId = str(args.projectId);
      const status = str(args.status);
      const assigneeId = args.assignedToMe === true ? ctx.userId : str(args.assigneeId);
      const tasks = await prisma.projectTask.findMany({
        where: {
          project: { companyId: ctx.companyId },
          ...(projectId ? { projectId } : {}),
          ...(status ? { status } : {}),
          ...(assigneeId ? { assigneeId } : {}),
          ...(args.overdue === true
            ? { dueDate: { lt: new Date() }, status: status ? status : { notIn: doneIds } }
            : {}),
        },
        orderBy: [{ dueDate: 'asc' }, { updatedAt: 'desc' }],
        take: 40,
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          dueDate: true,
          project: { select: { id: true, name: true } },
          assignee: PERSON,
        },
      });
      return {
        tasks: tasks.map((t) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority,
          due: day(t.dueDate),
          project: t.project,
          assignee: personName(t.assignee),
        })),
      };
    },
  },
  {
    name: 'get_project_task',
    description:
      'One task in full: description, subtasks, recent comments, recent activity and hours logged.',
    kind: 'read',
    parameters: {
      type: 'object',
      properties: { taskId: { type: 'string' } },
      required: ['taskId'],
    },
    execute: async (args, ctx) => {
      const task = await prisma.projectTask.findFirst({
        where: { id: String(args.taskId), project: { companyId: ctx.companyId } },
        include: {
          project: { select: { id: true, name: true } },
          assignee: PERSON,
          reporter: PERSON,
          subtasks: { select: { id: true, title: true, status: true } },
          comments: {
            orderBy: { createdAt: 'desc' },
            take: 20,
            include: { author: PERSON },
          },
          activities: { orderBy: { createdAt: 'desc' }, take: 15 },
        },
      });
      if (!task) throw new Error('Task not found in this workspace');
      const hours = await prisma.projectTaskWorklog.aggregate({
        where: { taskId: task.id },
        _sum: { hours: true },
      });
      return {
        task: {
          id: task.id,
          title: task.title,
          project: task.project,
          status: task.status,
          priority: task.priority,
          due: day(task.dueDate),
          assignee: task.assignee ? { id: task.assignee.id, name: personName(task.assignee) } : null,
          reporter: personName(task.reporter),
          description: stripHtmlToPreview(task.descriptionHtml, 2000) ?? task.description,
          hoursLogged: hours._sum.hours ?? 0,
          subtasks: task.subtasks,
          comments: task.comments.reverse().map((c) => ({
            id: c.id,
            author: personName(c.author),
            at: c.createdAt.toISOString(),
            text: stripHtmlToPreview(c.body, 1000),
          })),
          activity: task.activities.map((a) => ({
            at: a.createdAt.toISOString(),
            what: a.description,
          })),
        },
      };
    },
  },

  // ── Project writes (confirm-gated) ───────────────────────────────────────
  {
    name: 'create_project',
    description:
      'Create a delivery project. Website/web app/branding/SEO types get starter milestones. Requires confirmation.',
    kind: 'write',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        projectType: { type: 'string', description: PROJECT_TYPES.join('|') },
        startDate: { type: 'string', description: 'YYYY-MM-DD (default today)' },
        endDate: { type: 'string', description: 'YYYY-MM-DD (default +90 days)' },
        customerId: { type: 'string' },
        pmUserId: { type: 'string', description: 'Project lead user id' },
      },
      required: ['name'],
    },
    execute: async (args, ctx) => {
      assertManager(ctx);
      const name = str(args.name);
      if (!name) throw new Error('Name is required');
      const type = str(args.projectType)?.toLowerCase();
      const projectType = type && PROJECT_TYPES.includes(type) ? type : 'other';
      const customerId = str(args.customerId);
      if (customerId) {
        const c = await prisma.customer.findFirst({
          where: { id: customerId, companyId: ctx.companyId },
          select: { id: true },
        });
        if (!c) throw new Error('Customer not found in this workspace');
      }
      const pmUserId = str(args.pmUserId);
      if (pmUserId) await assertStaff(ctx, pmUserId);
      const templates = milestoneTemplatesFor(projectType);
      const project = await prisma.project.create({
        data: {
          name,
          description: str(args.description) ?? '',
          status: 'ACTIVE',
          projectType,
          startDate: parseDate(args.startDate, 'startDate') ?? new Date(),
          endDate:
            parseDate(args.endDate, 'endDate') ?? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          companyId: ctx.companyId,
          customerId: customerId ?? null,
          pmUserId: pmUserId ?? null,
          ...(templates.length
            ? {
                milestones: {
                  create: templates.map((m) => ({
                    title: m.title,
                    sortOrder: m.sortOrder,
                    status: 'PENDING',
                  })),
                },
              }
            : {}),
        },
        select: { id: true, name: true, status: true },
      });
      return { project, link: `/${ctx.companySlug}/dashboard/projects/${project.id}` };
    },
  },
  {
    name: 'update_project',
    description:
      'Change a project: name, description, status, dates, lead, hour budget or client. Requires confirmation.',
    kind: 'write',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        name: { type: 'string' },
        description: { type: 'string' },
        status: { type: 'string', description: PROJECT_STATUSES.join('|') },
        startDate: { type: 'string', description: 'YYYY-MM-DD' },
        endDate: { type: 'string', description: 'YYYY-MM-DD' },
        pmUserId: { type: 'string', description: 'Lead user id, or "none" to clear' },
        budgetHours: { type: 'number', description: 'Planned hours; 0 clears it' },
        customerId: { type: 'string', description: 'Client id, or "none" to clear' },
      },
      required: ['projectId'],
    },
    execute: async (args, ctx) => {
      assertManager(ctx);
      const project = await findProject(ctx, String(args.projectId));
      const data: Record<string, unknown> = {};
      if (str(args.name)) data.name = str(args.name);
      if (typeof args.description === 'string') data.description = args.description;
      const status = str(args.status)?.toUpperCase();
      if (status) {
        if (!PROJECT_STATUSES.includes(status)) throw new Error(`Status must be ${PROJECT_STATUSES.join(', ')}`);
        data.status = status;
      }
      const start = parseDate(args.startDate, 'startDate');
      if (start) data.startDate = start;
      const end = parseDate(args.endDate, 'endDate');
      if (end) data.endDate = end;
      const pm = str(args.pmUserId);
      if (pm) {
        if (pm === 'none') data.pmUserId = null;
        else {
          await assertStaff(ctx, pm);
          data.pmUserId = pm;
        }
      }
      if (typeof args.budgetHours === 'number' && Number.isFinite(args.budgetHours)) {
        data.budgetHours = args.budgetHours > 0 ? args.budgetHours : null;
      }
      const cust = str(args.customerId);
      if (cust) {
        if (cust === 'none') data.customerId = null;
        else {
          const c = await prisma.customer.findFirst({
            where: { id: cust, companyId: ctx.companyId },
            select: { id: true },
          });
          if (!c) throw new Error('Customer not found in this workspace');
          data.customerId = cust;
        }
      }
      if (Object.keys(data).length === 0) throw new Error('Nothing to change');
      const updated = await prisma.project.update({
        where: { id: project.id },
        data,
        select: { id: true, name: true, status: true, pmUserId: true, budgetHours: true },
      });
      return { project: updated };
    },
  },
  {
    name: 'add_project_member',
    description: 'Add a teammate to a project team. Requires confirmation.',
    kind: 'write',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        userId: { type: 'string', description: 'userId from search_team_members' },
        role: { type: 'string', description: 'PM|DESIGN|DEV|SEO|OTHER' },
      },
      required: ['projectId', 'userId'],
    },
    execute: async (args, ctx) => {
      assertManager(ctx);
      const project = await findProject(ctx, String(args.projectId));
      const userId = String(args.userId);
      await assertStaff(ctx, userId);
      const roleArg = str(args.role)?.toUpperCase();
      const role = roleArg && ['PM', 'DESIGN', 'DEV', 'SEO', 'OTHER'].includes(roleArg) ? roleArg : 'OTHER';
      const member = await prisma.projectMember.upsert({
        where: { projectId_userId: { projectId: project.id, userId } },
        create: { projectId: project.id, userId, role },
        update: { role },
        include: { user: PERSON },
      });
      return { member: { userId, name: personName(member.user), role: member.role }, project: project.name };
    },
  },
  {
    name: 'remove_project_member',
    description: 'Remove a teammate from a project team. Requires confirmation.',
    kind: 'write',
    parameters: {
      type: 'object',
      properties: { projectId: { type: 'string' }, userId: { type: 'string' } },
      required: ['projectId', 'userId'],
    },
    execute: async (args, ctx) => {
      assertManager(ctx);
      const project = await findProject(ctx, String(args.projectId));
      const removed = await prisma.projectMember.deleteMany({
        where: { projectId: project.id, userId: String(args.userId) },
      });
      if (!removed.count) throw new Error('That person is not on this project');
      return { removed: true, project: project.name };
    },
  },

  // ── Milestones (confirm-gated) ───────────────────────────────────────────
  {
    name: 'add_project_milestone',
    description: 'Add a milestone (a big phase) to a project. Requires confirmation.',
    kind: 'write',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        title: { type: 'string' },
        dueDate: { type: 'string', description: 'YYYY-MM-DD' },
      },
      required: ['projectId', 'title'],
    },
    execute: async (args, ctx) => {
      assertManager(ctx);
      const project = await findProject(ctx, String(args.projectId));
      const title = str(args.title);
      if (!title) throw new Error('Title required');
      const max = await prisma.projectMilestone.aggregate({
        where: { projectId: project.id },
        _max: { sortOrder: true },
      });
      const milestone = await prisma.projectMilestone.create({
        data: {
          projectId: project.id,
          title,
          status: 'PENDING',
          dueDate: parseDate(args.dueDate, 'dueDate') ?? null,
          sortOrder: (max._max.sortOrder ?? -1) + 1,
        },
        select: { id: true, title: true, status: true },
      });
      const progress = await syncProjectProgress(project.id, ctx.companyId);
      return { milestone, progress };
    },
  },
  {
    name: 'update_project_milestone',
    description:
      'Rename a milestone, change its due date, or mark it PENDING / IN_PROGRESS / DONE. Requires confirmation.',
    kind: 'write',
    parameters: {
      type: 'object',
      properties: {
        milestoneId: { type: 'string' },
        title: { type: 'string' },
        status: { type: 'string', description: MILESTONE_STATUSES.join('|') },
        dueDate: { type: 'string', description: 'YYYY-MM-DD, or "none" to clear' },
      },
      required: ['milestoneId'],
    },
    execute: async (args, ctx) => {
      assertManager(ctx);
      const existing = await prisma.projectMilestone.findFirst({
        where: { id: String(args.milestoneId), project: { companyId: ctx.companyId } },
        select: { id: true, projectId: true },
      });
      if (!existing) throw new Error('Milestone not found in this workspace');
      const data: Record<string, unknown> = {};
      if (str(args.title)) data.title = str(args.title);
      const status = str(args.status)?.toUpperCase();
      if (status) {
        if (!MILESTONE_STATUSES.includes(status)) {
          throw new Error(`Status must be ${MILESTONE_STATUSES.join(', ')}`);
        }
        data.status = status;
        data.completedAt = status === 'DONE' ? new Date() : null;
      }
      if (str(args.dueDate) === 'none') data.dueDate = null;
      else {
        const due = parseDate(args.dueDate, 'dueDate');
        if (due) data.dueDate = due;
      }
      if (Object.keys(data).length === 0) throw new Error('Nothing to change');
      const milestone = await prisma.projectMilestone.update({
        where: { id: existing.id },
        data,
        select: { id: true, title: true, status: true, dueDate: true },
      });
      const progress = await syncProjectProgress(existing.projectId, ctx.companyId);
      return { milestone, progress };
    },
  },
  {
    name: 'delete_project_milestone',
    description: 'Delete a milestone from a project. Requires confirmation.',
    kind: 'write',
    parameters: {
      type: 'object',
      properties: { milestoneId: { type: 'string' } },
      required: ['milestoneId'],
    },
    execute: async (args, ctx) => {
      assertManager(ctx);
      const existing = await prisma.projectMilestone.findFirst({
        where: { id: String(args.milestoneId), project: { companyId: ctx.companyId } },
        select: { id: true, projectId: true, title: true },
      });
      if (!existing) throw new Error('Milestone not found in this workspace');
      await prisma.projectMilestone.delete({ where: { id: existing.id } });
      const progress = await syncProjectProgress(existing.projectId, ctx.companyId);
      return { deleted: existing.title, progress };
    },
  },

  // ── Tasks, comments, time (confirm-gated) ───────────────────────────────
  {
    name: 'create_project_task',
    description:
      'Create a task (or a subtask with parentTaskId) on a project board. Status must be one of the project board statuses. Requires confirmation.',
    kind: 'write',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        title: { type: 'string' },
        description: { type: 'string' },
        status: { type: 'string', description: 'Board status id (default TODO)' },
        priority: { type: 'string', description: PROJECT_PRIORITIES.join('|') },
        assigneeId: { type: 'string', description: 'userId from search_team_members (not employeeId)' },
        dueDate: { type: 'string', description: 'YYYY-MM-DD' },
        parentTaskId: { type: 'string', description: 'Make this a subtask of that task' },
      },
      required: ['projectId', 'title'],
    },
    execute: async (args, ctx) => {
      const project = await findProject(ctx, String(args.projectId));
      await assertCanWrite(ctx, project.id);
      const description = str(args.description);
      const result = await createProjectTask({
        session: agentSession(ctx),
        companyId: ctx.companyId,
        projectId: project.id,
        body: {
          title: args.title,
          status: str(args.status)?.toUpperCase(),
          priority: str(args.priority)?.toUpperCase(),
          assigneeId: str(args.assigneeId),
          dueDate: str(args.dueDate),
          parentTaskId: str(args.parentTaskId),
          ...(description ? { descriptionHtml: textToHtml(description) } : {}),
        },
      });
      if (!result.ok) throw new Error(result.error);
      await result.effects();
      return {
        task: {
          id: result.task.id,
          title: result.task.title,
          status: result.task.status,
          priority: result.task.priority,
        },
        project: project.name,
        progress: result.progress,
      };
    },
  },
  {
    name: 'update_project_task',
    description:
      'Change a task: title, description, status (move on the board), priority, assignee ("none" to unassign) or due date ("none" to clear). Requires confirmation.',
    kind: 'write',
    parameters: {
      type: 'object',
      properties: {
        taskId: { type: 'string' },
        title: { type: 'string' },
        description: { type: 'string' },
        status: { type: 'string', description: 'Board status id, e.g. IN_PROGRESS, DONE' },
        priority: { type: 'string', description: PROJECT_PRIORITIES.join('|') },
        assigneeId: { type: 'string', description: 'userId from search_team_members (not employeeId)' },
        dueDate: { type: 'string', description: 'YYYY-MM-DD' },
      },
      required: ['taskId'],
    },
    execute: async (args, ctx) => {
      const task = await findTask(ctx, String(args.taskId));
      await assertCanWrite(ctx, task.projectId);
      const body: Record<string, unknown> = {};
      if (str(args.title)) body.title = str(args.title);
      if (typeof args.description === 'string') body.descriptionHtml = textToHtml(args.description);
      if (str(args.status)) body.status = str(args.status)!.toUpperCase();
      if (str(args.priority)) body.priority = str(args.priority)!.toUpperCase();
      const assignee = str(args.assigneeId);
      if (assignee) body.assigneeId = assignee === 'none' ? null : assignee;
      const due = str(args.dueDate);
      if (due) body.dueDate = due === 'none' ? null : due;
      if (Object.keys(body).length === 0) throw new Error('Nothing to change');

      const result = await updateProjectTask({
        session: agentSession(ctx),
        companyId: ctx.companyId,
        projectId: task.projectId,
        taskId: task.id,
        body,
      });
      if (!result.ok) throw new Error(result.error);
      await result.effects();
      return { taskId: task.id, title: task.title, changed: result.changed, progress: result.progress };
    },
  },
  {
    name: 'delete_project_task',
    description: 'Delete a task (and its subtasks) from a project. Requires confirmation.',
    kind: 'write',
    parameters: {
      type: 'object',
      properties: { taskId: { type: 'string' } },
      required: ['taskId'],
    },
    execute: async (args, ctx) => {
      const task = await findTask(ctx, String(args.taskId));
      await assertCanWrite(ctx, task.projectId);
      await prisma.projectTask.delete({ where: { id: task.id } });
      const progress = await syncProjectProgress(task.projectId, ctx.companyId);
      return { deleted: task.title, progress };
    },
  },
  {
    name: 'add_task_comment',
    description:
      'Post a comment on a project task (watchers and the assignee are notified). Requires confirmation.',
    kind: 'write',
    parameters: {
      type: 'object',
      properties: {
        taskId: { type: 'string' },
        comment: { type: 'string' },
      },
      required: ['taskId', 'comment'],
    },
    execute: async (args, ctx) => {
      const task = await findTask(ctx, String(args.taskId));
      await assertCanWrite(ctx, task.projectId);
      const text = str(args.comment);
      if (!text) throw new Error('Comment required');
      const result = await addProjectTaskComment({
        session: agentSession(ctx),
        companyId: ctx.companyId,
        projectId: task.projectId,
        taskId: task.id,
        bodyHtml: textToHtml(text),
      });
      if (!result.ok) throw new Error(result.error);
      await result.effects();
      return { commentId: result.comment.id, task: task.title };
    },
  },
  {
    name: 'log_task_hours',
    description: 'Log hours worked on a project task for the user. Requires confirmation.',
    kind: 'write',
    parameters: {
      type: 'object',
      properties: {
        taskId: { type: 'string' },
        hours: { type: 'number' },
        note: { type: 'string' },
        date: { type: 'string', description: 'YYYY-MM-DD (default today)' },
      },
      required: ['taskId', 'hours'],
    },
    execute: async (args, ctx) => {
      const task = await findTask(ctx, String(args.taskId));
      await assertCanWrite(ctx, task.projectId);
      const hours = Number(args.hours);
      if (!Number.isFinite(hours) || hours <= 0 || hours > 24) {
        throw new Error('Hours must be between 0 and 24');
      }
      const worklog = await prisma.projectTaskWorklog.create({
        data: {
          taskId: task.id,
          userId: ctx.userId,
          hours,
          note: str(args.note) ?? null,
          loggedAt: parseDate(args.date, 'date') ?? new Date(),
        },
        select: { id: true, hours: true, loggedAt: true },
      });
      return { worklog, task: task.title };
    },
  },
];
