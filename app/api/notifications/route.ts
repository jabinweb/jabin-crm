import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import {
  resolveCompanyContextFromRequest,
  TenantError,
} from '@/lib/auth/company-membership'
import { LeaveStatus, EmployeeMessageStatus } from '@prisma/client'
import { notificationService } from '@/lib/crm/notification-service'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const role = String(session.user.role || '')
    const isWorkspaceAdmin =
      role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'SUPPORT_MANAGER'

    type NotificationItem = {
      id: string
      title: string
      message: string
      type: string
      targetRole: string[]
      metadata: Record<string, unknown>
      createdAt: string
      expiresAt: string
      read: boolean
    }

    const notifications: NotificationItem[] = []

    const employeeId =
      typeof session.user.employeeId === 'string' && session.user.employeeId.trim()
        ? session.user.employeeId.trim()
        : undefined
    const customerId =
      typeof session.user.customerId === 'string' && session.user.customerId.trim()
        ? session.user.customerId.trim()
        : undefined
    const sessionCompanyId =
      typeof session.user.companyId === 'string' && session.user.companyId.trim()
        ? session.user.companyId.trim()
        : undefined

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    // Run the expensive feed sources in parallel — sequential awaits were stacking Neon latency.
    const [dbNotes, recentTasks, recentMessages, recentLeaveRequests, pendingLeave] =
      await Promise.all([
        notificationService
          .getForUser(session.user.id, 40, customerId)
          .catch((error) => {
            console.error(
              'Notifications feed degraded:',
              error instanceof Error ? error.message : 'Unknown error'
            )
            return [] as Awaited<ReturnType<typeof notificationService.getForUser>>
          }),
        // Delivery assignments (ProjectTask) — replaces legacy CompanyTask feed
        prisma.projectTask.findMany({
          where: {
            assigneeId: session.user.id,
            createdAt: { gte: sevenDaysAgo },
          },
          include: {
            project: { select: { id: true, name: true } },
            reporter: { select: { name: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 15,
        }),
        employeeId
          ? prisma.employeeMessage.findMany({
              where: {
                receiverId: employeeId,
                createdAt: { gte: sevenDaysAgo },
              },
              include: { sender: { select: { name: true } } },
              orderBy: { createdAt: 'desc' },
              take: 10,
            })
          : Promise.resolve([]),
        employeeId
          ? prisma.leaveRequest.findMany({
              where: {
                employeeId,
                status: { in: [LeaveStatus.APPROVED, LeaveStatus.REJECTED] },
                actionAt: { gte: thirtyDaysAgo },
              },
              include: { actor: { select: { name: true } } },
              orderBy: { actionAt: 'desc' },
              take: 10,
            })
          : Promise.resolve([]),
        isWorkspaceAdmin
          ? (async () => {
              try {
                const companyId =
                  sessionCompanyId ||
                  (await resolveCompanyContextFromRequest(session, request)).companyId
                return {
                  companyId,
                  count: await prisma.leaveRequest.count({
                    where: {
                      employee: { companyId },
                      status: LeaveStatus.PENDING,
                    },
                  }),
                }
              } catch (e) {
                if (!(e instanceof TenantError)) throw e
                return null
              }
            })()
          : Promise.resolve(null),
      ])

    for (const n of dbNotes) {
      notifications.push({
        id: n.id,
        title: n.title,
        message: n.body,
        type: n.type,
        targetRole: [role || 'USER'],
        metadata: (n.metadata as Record<string, unknown>) || {},
        createdAt: n.createdAt.toISOString(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        read: n.read,
      })
    }

    notifications.push(
      ...recentTasks.map((task) => ({
        id: `project-task-${task.id}`,
        title: 'Project task assigned',
        message: `${task.reporter?.name || 'Someone'} assigned you: ${task.title} (${task.project.name})`,
        type: 'PROJECT_TASK_ASSIGNED',
        targetRole: ['EMPLOYEE', 'SALES', 'TECHNICIAN', 'ADMIN'],
        metadata: {
          taskId: task.id,
          projectId: task.project.id,
          title: task.title,
          priority: task.priority,
          status: task.status,
          projectName: task.project.name,
          assignedBy: task.reporter?.name,
        },
        createdAt: task.createdAt.toISOString(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        read: false,
      }))
    )

    notifications.push(
      ...recentMessages.map((msg) => ({
        id: `message-${msg.id}`,
        title: 'New message',
        message: `${msg.sender.name}: ${msg.content.slice(0, 120)}`,
        type: 'MESSAGE',
        targetRole: ['EMPLOYEE'],
        metadata: { messageId: msg.id },
        createdAt: msg.createdAt.toISOString(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        read: msg.status === EmployeeMessageStatus.READ,
      }))
    )

    notifications.push(
      ...recentLeaveRequests.map((leaveRequest) => ({
        id: `leave-status-${leaveRequest.id}`,
        title: `Leave request ${leaveRequest.status}`,
        message: `Your leave request has been ${leaveRequest.status.toLowerCase()}${
          leaveRequest.comment ? `: ${leaveRequest.comment}` : ''
        }`,
        type:
          leaveRequest.status === LeaveStatus.APPROVED
            ? 'LEAVE_APPROVED'
            : 'LEAVE_REJECTED',
        targetRole: ['EMPLOYEE'],
        metadata: {
          requestId: leaveRequest.id,
          status: leaveRequest.status,
          comment: leaveRequest.comment,
          actionBy: leaveRequest.actor?.name,
        },
        createdAt:
          leaveRequest.actionAt?.toISOString() ||
          leaveRequest.updatedAt.toISOString(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        read: false,
      }))
    )

    if (pendingLeave && pendingLeave.count > 0) {
      notifications.push({
        id: `admin-leave-pending-${pendingLeave.companyId}`,
        title: 'Pending leave requests',
        message: `${pendingLeave.count} leave request(s) awaiting approval`,
        type: 'LEAVE_PENDING',
        targetRole: ['ADMIN'],
        metadata: { count: pendingLeave.count },
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        read: false,
      })
    }

    notifications.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )

    return NextResponse.json(notifications.slice(0, 50))
  } catch (error) {
    console.error(
      'Notifications generation error:',
      error instanceof Error ? error.message : 'Unknown error'
    )
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch notifications',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const action = body?.action as string | undefined
    const notificationId = typeof body?.notificationId === 'string' ? body.notificationId : null

    if (action === 'markAsRead' || action === 'markAllAsRead' || action === 'dismiss') {
      if (action === 'markAllAsRead') {
        await notificationService.markAllRead(session.user.id)
        return NextResponse.json({ success: true })
      }
      if (
        notificationId &&
        !notificationId.startsWith('task-') &&
        !notificationId.startsWith('leave-') &&
        !notificationId.startsWith('message-') &&
        !notificationId.startsWith('admin-') &&
        !notificationId.startsWith('leave-status-')
      ) {
        await notificationService.markRead(notificationId).catch(() => null)
      }
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error) {
    console.error('[api/notifications POST]', error)
    return NextResponse.json({ error: 'Failed to update notification' }, { status: 500 })
  }
}
