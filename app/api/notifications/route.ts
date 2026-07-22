import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { EmployeeMessageStatus, LeaveStatus } from '@prisma/client'
import { auth } from '@/auth'
import {
  resolveCompanyContextFromRequest,
  TenantError,
} from '@/lib/auth/company-membership'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Always trust session role — never the client query string.
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

    if (employeeId) {
      const recentTasks = await prisma.companyTask.findMany({
        where: {
          assignedToId: employeeId,
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
        include: {
          creator: {
            select: { name: true },
          },
        },
        orderBy: { createdAt: 'desc' },
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
          status: EmployeeMessageStatus.SENT,
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      })

      notifications.push(
        ...recentMessages.map((message) => ({
          id: `message-${message.id}`,
          title: 'New message',
          message: `${message.sender.name}: ${message.content.substring(0, 50)}${
            message.content.length > 50 ? '...' : ''
          }`,
          type: 'NEW_MESSAGE',
          targetRole: ['ADMIN', 'MANAGER', 'EMPLOYEE'],
          metadata: {
            senderId: message.senderId,
            senderName: message.sender.name,
            messageId: message.id,
            preview: message.content.substring(0, 50),
          },
          createdAt: message.createdAt.toISOString(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          read: false,
        }))
      )
    }

    if (isWorkspaceAdmin) {
      let leaveCompanyId: string | undefined
      try {
        leaveCompanyId = (await resolveCompanyContextFromRequest(session, request))
          .companyId
      } catch (e) {
        if (!(e instanceof TenantError)) throw e
      }

      if (leaveCompanyId) {
        const pendingLeaveRequests = await prisma.leaveRequest.findMany({
          where: {
            status: LeaveStatus.PENDING,
            employee: { companyId: leaveCompanyId },
          },
          include: {
            employee: {
              select: {
                name: true,
                id: true,
                department: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        })

        notifications.push(
          ...pendingLeaveRequests.map((leaveRequest) => ({
            id: `leave-${leaveRequest.id}`,
            title: 'Leave request pending',
            message: `${leaveRequest.employee.name} (${leaveRequest.employee.department}) has requested ${leaveRequest.type} leave from ${leaveRequest.startDate.toLocaleDateString()} to ${leaveRequest.endDate.toLocaleDateString()}\n\nReason: ${leaveRequest.reason}`,
            type: 'LEAVE_REQUEST',
            targetRole: ['ADMIN', 'MANAGER'],
            metadata: {
              requestId: leaveRequest.id,
              employeeId: leaveRequest.employee.id,
              employeeName: leaveRequest.employee.name,
              department: leaveRequest.employee.department,
              startDate: leaveRequest.startDate,
              endDate: leaveRequest.endDate,
              type: leaveRequest.type,
              reason: leaveRequest.reason,
              status: leaveRequest.status,
            },
            createdAt: leaveRequest.createdAt.toISOString(),
            expiresAt: leaveRequest.endDate.toISOString(),
            read: false,
          }))
        )
      }
    }

    if (employeeId) {
      const recentLeaveRequests = await prisma.leaveRequest.findMany({
        where: {
          employeeId,
          status: {
            in: [LeaveStatus.APPROVED, LeaveStatus.REJECTED],
          },
          actionAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        },
        include: {
          actor: {
            select: { name: true },
          },
        },
        orderBy: { actionAt: 'desc' },
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

    notifications.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )

    return NextResponse.json(notifications)
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
