import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { EmployeeMessageStatus, LeaveStatus } from '@prisma/client'
import { auth } from '@/auth'
import "@/types/auth";
import {
  resolveCompanyContextFromRequest,
  TenantError,
} from '@/lib/auth/company-membership'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    const { searchParams } = new URL(request.url)
    const role = searchParams.get('role')

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    type NotificationItem = {
      id: string
      title: string
      message: string
      type: string
      targetRole: string[]
      metadata: Record<string, unknown>
      createdAt: string
      expiresAt: string
    }

    const notifications: NotificationItem[] = []

    const employeeId =
      typeof session.user.employeeId === 'string' && session.user.employeeId.trim()
        ? session.user.employeeId.trim()
        : undefined

    // Task + employee-message feeds require an Employee row (receiverId / assignee are employee IDs).
    if (employeeId) {
      const recentTasks = await prisma.companyTask.findMany({
        where: {
          assignedToId: employeeId,
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
          }
        },
        include: {
          creator: {
            select: {
              name: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      })

      notifications.push(...recentTasks.map(task => ({
        id: `task-${task.id}`,
        title: 'New CompanyTask Assignment',
        message: `${task.creator.name} assigned you a task: ${task.title}`,
        type: 'TASK_ASSIGNED',
        targetRole: ['EMPLOYEE'],
        metadata: {
          taskId: task.id,
          title: task.title,
          priority: task.priority,
          status: task.status,
          assignedBy: task.creator.name
        },
        createdAt: task.createdAt.toISOString(),
        expiresAt: task.dueDate?.toISOString() || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      })))

      const recentMessages = await prisma.employeeMessage.findMany({
        where: {
          receiverId: employeeId,
          status: EmployeeMessageStatus.SENT,
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        },
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              avatar: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      })

      notifications.push(...recentMessages.map(message => ({
        id: `message-${message.id}`,
        title: 'New EmployeeMessage',
        message: `${message.sender.name}: ${message.content.substring(0, 50)}${message.content.length > 50 ? '...' : ''}`,
        type: 'NEW_MESSAGE',
        targetRole: ['ADMIN', 'MANAGER', 'EMPLOYEE'],
        metadata: {
          senderId: message.senderId,
          senderName: message.sender.name,
          messageId: message.id,
          preview: message.content.substring(0, 50)
        },
        createdAt: message.createdAt.toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      })))
    }

    // For ADMIN/MANAGER: Get pending leave requests (tenant from workspace header / session)
    if (role === 'ADMIN' || role === 'MANAGER') {
      let leaveCompanyId: string | undefined
      try {
        leaveCompanyId = (await resolveCompanyContextFromRequest(session, request)).companyId
      } catch (e) {
        if (!(e instanceof TenantError)) throw e
      }

      if (leaveCompanyId) {
      const pendingLeaveRequests = await prisma.leaveRequest.findMany({
        where: {
          status: LeaveStatus.PENDING,
          employee: {
            companyId: leaveCompanyId
          }
        },
        include: {
          employee: {
            select: {
              name: true,
              id: true,
              department: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      })

      notifications.push(...pendingLeaveRequests.map(request => ({
        id: `leave-${request.id}`,
        title: 'Leave Request Pending',
        message: `${request.employee.name} (${request.employee.department}) has requested ${request.type} leave from ${request.startDate.toLocaleDateString()} to ${request.endDate.toLocaleDateString()}\n\nReason: ${request.reason}`,
        type: 'LEAVE_REQUEST',
        targetRole: ['ADMIN', 'MANAGER'],
        metadata: {
          requestId: request.id,
          employeeId: request.employee.id,
          employeeName: request.employee.name,
          department: request.employee.department,
          startDate: request.startDate,
          endDate: request.endDate,
          type: request.type,
          reason: request.reason,
          status: request.status
        },
        createdAt: request.createdAt.toISOString(),
        expiresAt: request.endDate.toISOString()
      })))
      }
    }

    // For EMPLOYEE: Get their recent leave request updates
    if (role === 'EMPLOYEE' && employeeId) {
      const recentLeaveRequests = await prisma.leaveRequest.findMany({
        where: {
          employeeId,
          status: {
            in: [LeaveStatus.APPROVED, LeaveStatus.REJECTED],
          },
          actionAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          }
        },
        include: {
          actor: {
            select: {
              name: true
            }
          }
        },
        orderBy: {
          actionAt: 'desc'
        }
      })

      notifications.push(...recentLeaveRequests.map(request => ({
        id: `leave-status-${request.id}`,
        title: `Leave Request ${request.status}`,
        message: `Your leave request has been ${request.status.toLowerCase()}${request.comment ? `: ${request.comment}` : ''}`,
        type: request.status === LeaveStatus.APPROVED ? 'LEAVE_APPROVED' : 'LEAVE_REJECTED',
        targetRole: ['EMPLOYEE'],
        metadata: {
          requestId: request.id,
          status: request.status,
          comment: request.comment,
          actionBy: request.actor?.name
        },
        createdAt: request.actionAt?.toISOString() || request.updatedAt.toISOString(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      })))
    }
    
    // Sort all notifications by creation date
    notifications.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    
    return NextResponse.json(notifications)

  } catch (error) {
    console.error('Notifications generation error:', 
      error instanceof Error ? error.message : 'Unknown error'
    )
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch notifications',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

