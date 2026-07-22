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

    // Persistent DB notifications (CRM / tickets / workflows)
    const dbNotes = await notificationService.getForUser(session.user.id, 40)
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

    const employeeId =
      typeof session.user.employeeId === 'string' && session.user.employeeId.trim()
        ? session.user.employeeId.trim()
        : undefined

    if (employeeId) {
      const recentTasks = await prisma.companyTask.findMany({
        where: {
          assignedToId: employeeId,
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
        include: {
          creator: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 15,
      })

      notifications.push(
        ...recentTasks.map((task) => ({
          id: `task-${task.id}`,
          title: 'New task assignment',
          message: `${task.creator.name} assigned you a task: ${task.title}`,
          type: 'TASK_ASSIGNED',
          targetRole: ['EMPLOYEE'],
          metadata: {
            taskId: task.id,
            title: task.title,
            priority: task.priority,
            status: task.status,
            assignedBy: task.creator.name,
          },
          createdAt: task.createdAt.toISOString(),
          expiresAt:
            task.dueDate?.toISOString() ||
            new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          read: false,
        }))
      )

      const recentMessages = await prisma.employeeMessage.findMany({
        where: {
          receiverId: employeeId,
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
        include: { sender: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      })

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

      const recentLeaveRequests = await prisma.leaveRequest.findMany({
        where: {
          employeeId,
          status: { in: [LeaveStatus.APPROVED, LeaveStatus.REJECTED] },
          actionAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
        include: { actor: { select: { name: true } } },
        orderBy: { actionAt: 'desc' },
        take: 10,
      })

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
    }

    if (isWorkspaceAdmin) {
      try {
        const { companyId } = await resolveCompanyContextFromRequest(session, request)
        const pendingLeave = await prisma.leaveRequest.count({
          where: { employee: { companyId }, status: LeaveStatus.PENDING },
        })
        if (pendingLeave > 0) {
          notifications.push({
            id: `admin-leave-pending-${companyId}`,
            title: 'Pending leave requests',
            message: `${pendingLeave} leave request(s) awaiting approval`,
            type: 'LEAVE_PENDING',
            targetRole: ['ADMIN'],
            metadata: { count: pendingLeave },
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            read: false,
          })
        }
      } catch (e) {
        if (!(e instanceof TenantError)) throw e
      }
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
