import { prisma } from '@/lib/prisma';

export interface CreateTaskData {
  leadId?: string;
  dealId?: string;
  title: string;
  description?: string;
  type?: 'CALL' | 'EMAIL' | 'MEETING' | 'FOLLOW_UP' | 'TODO' | 'DEMO' | 'PROPOSAL';
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  dueDate?: Date;
  reminderAt?: Date;
}

export class TaskService {
  /**
   * Create a new task
   */
  async createTask(userId: string, data: CreateTaskData) {
    const task = await prisma.task.create({
      data: {
        userId,
        leadId: data.leadId,
        dealId: data.dealId,
        title: data.title,
        description: data.description,
        type: data.type || 'TODO',
        priority: data.priority || 'MEDIUM',
        dueDate: data.dueDate,
        reminderAt: data.reminderAt,
        status: 'PENDING',
      },
      include: {
        lead: {
          select: {
            id: true,
            companyName: true,
            email: true,
          },
        },
        deal: {
          select: {
            id: true,
            title: true,
            value: true,
          },
        },
      },
    });

    return task;
  }

  /**
   * Get tasks for a user
   */
  async getUserTasks(userId: string, filters?: {
    status?: string;
    priority?: string;
    type?: string;
    leadId?: string;
    dealId?: string;
    overdue?: boolean;
  }) {
    const where: any = { userId };

    if (filters?.status) where.status = filters.status;
    if (filters?.priority) where.priority = filters.priority;
    if (filters?.type) where.type = filters.type;
    if (filters?.leadId) where.leadId = filters.leadId;
    if (filters?.dealId) where.dealId = filters.dealId;

    if (filters?.overdue) {
      where.dueDate = {
        lt: new Date(),
      };
      where.status = {
        not: 'COMPLETED',
      };
    }

    return await prisma.task.findMany({
      where,
      include: {
        lead: {
          select: {
            id: true,
            companyName: true,
            email: true,
          },
        },
        deal: {
          select: {
            id: true,
            title: true,
            value: true,
            stage: true,
          },
        },
      },
      orderBy: [
        { status: 'asc' }, // Pending first
        { priority: 'desc' }, // High priority first
        { dueDate: 'asc' },
      ],
    });
  }

  /**
   * Update task
   */
  async updateTask(taskId: string, data: Partial<CreateTaskData> & { status?: string }) {
    const updateData: any = {};

    if (data.title) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.type) updateData.type = data.type;
    if (data.priority) updateData.priority = data.priority;
    if (data.dueDate !== undefined) updateData.dueDate = data.dueDate;
    if (data.reminderAt !== undefined) updateData.reminderAt = data.reminderAt;
    if (data.status) {
      updateData.status = data.status;
      if (data.status === 'COMPLETED') {
        updateData.completedAt = new Date();
      }
    }

    return await prisma.task.update({
      where: { id: taskId },
      data: updateData,
      include: {
        lead: {
          select: {
            id: true,
            companyName: true,
            email: true,
          },
        },
        deal: {
          select: {
            id: true,
            title: true,
            value: true,
          },
        },
      },
    });
  }

  /**
   * Complete a task
   */
  async completeTask(taskId: string) {
    return await this.updateTask(taskId, { status: 'COMPLETED' });
  }

  /**
   * Delete a task
   */
  async deleteTask(taskId: string) {
    return await prisma.task.delete({
      where: { id: taskId },
    });
  }

  /**
   * Get tasks due today
   */
  async getTasksDueToday(userId: string) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    return await prisma.task.findMany({
      where: {
        userId,
        dueDate: {
          gte: startOfDay,
          lte: endOfDay,
        },
        status: {
          not: 'COMPLETED',
        },
      },
      include: {
        lead: {
          select: {
            id: true,
            companyName: true,
            email: true,
          },
        },
        deal: {
          select: {
            id: true,
            title: true,
            value: true,
          },
        },
      },
      orderBy: [
        { priority: 'desc' },
        { dueDate: 'asc' },
      ],
    });
  }

  /**
   * Get overdue tasks
   */
  async getOverdueTasks(userId: string) {
    return await this.getUserTasks(userId, { overdue: true });
  }

  /**
   * Get task stats
   */
  async getTaskStats(userId: string) {
    const tasks = await prisma.task.findMany({
      where: { userId },
      select: {
        status: true,
        priority: true,
        dueDate: true,
      },
    });

    const now = new Date();

    return {
      total: tasks.length,
      pending: tasks.filter((t) => t.status === 'PENDING').length,
      inProgress: tasks.filter((t) => t.status === 'IN_PROGRESS').length,
      completed: tasks.filter((t) => t.status === 'COMPLETED').length,
      overdue: tasks.filter(
        (t) => t.dueDate && t.dueDate < now && t.status !== 'COMPLETED'
      ).length,
      highPriority: tasks.filter(
        (t) => (t.priority === 'HIGH' || t.priority === 'URGENT') && t.status !== 'COMPLETED'
      ).length,
    };
  }

  /**
   * Auto-create follow-up task when lead is contacted
   */
  async createFollowUpTask(userId: string, leadId: string, daysDelay: number = 3) {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + daysDelay);

    return await this.createTask(userId, {
      leadId,
      title: 'Follow up with lead',
      description: 'Check if they received the email and need any additional information',
      type: 'FOLLOW_UP',
      priority: 'MEDIUM',
      dueDate,
    });
  }
}

export const taskService = new TaskService();
