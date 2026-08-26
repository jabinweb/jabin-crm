import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { LeadStatus, AttendanceStatus, ActivityType } from '@prisma/client'
import { NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.employeeId || !session.user.id) {
      return new Response('Unauthorized', { status: 401 })
    }

    const userId = session.user.id
    const employeeId = session.user.employeeId

    // Get today's date range
    const today = new Date()
    const startOfDay = new Date(today)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(today)
    endOfDay.setHours(23, 59, 59, 999)

    // Get last week for leads
    const lastWeek = new Date(today)
    lastWeek.setDate(lastWeek.getDate() - 7)

    const openStatuses = { notIn: ['DONE', 'CANCELLED'] }

    const [
      totalLeads,
      newLeadsThisWeek,
      wonLeads,
      qualifiedLeads,
      activeTasks,
      upcomingTasks,
      completedTasks,
      overdueTasks,
      pendingFollowUps,
      todayFollowUps,
      unreadMessages,
      todayAttendance
    ] = await Promise.all([
      prisma.lead.count({
        where: { employeeId }
      }),
      prisma.lead.count({
        where: {
          employeeId,
          createdAt: { gte: lastWeek }
        }
      }),
      prisma.lead.count({
        where: {
          employeeId,
          status: LeadStatus.WON
        }
      }),
      prisma.lead.count({
        where: {
          employeeId,
          status: { in: [LeadStatus.QUALIFIED, LeadStatus.PROPOSAL, LeadStatus.NEGOTIATION] }
        }
      }),
      // Delivery ProjectTasks assigned to this user
      prisma.projectTask.count({
        where: {
          assigneeId: userId,
          status: openStatuses,
        }
      }),
      prisma.projectTask.count({
        where: {
          assigneeId: userId,
          status: { in: ['TODO', 'BACKLOG'] },
          dueDate: { lte: new Date(today.getTime() + 24 * 60 * 60 * 1000) }
        }
      }),
      prisma.projectTask.count({
        where: {
          assigneeId: userId,
          status: 'DONE',
        }
      }),
      prisma.projectTask.count({
        where: {
          assigneeId: userId,
          status: openStatuses,
          dueDate: { lt: today },
        }
      }),
      prisma.leadActivity.count({
        where: {
          employeeId,
          activityType: ActivityType.FOLLOW_UP,
          completed: false,
        }
      }),
      prisma.leadActivity.count({
        where: {
          employeeId,
          activityType: ActivityType.FOLLOW_UP,
          completed: false,
          dueDate: {
            gte: startOfDay,
            lte: endOfDay
          }
        }
      }),
      prisma.employeeMessage.count({
        where: {
          receiverId: employeeId,
          status: 'SENT'
        }
      }),
      prisma.attendance.findFirst({
        where: {
          employeeId,
          AND: [
            { createdAt: { gte: startOfDay } },
            { createdAt: { lte: endOfDay } }
          ]
        },
        select: {
          status: true,
          checkIn: true,
          checkOut: true,
          createdAt: true,
        }
      })
    ])

    const conversionRate = totalLeads
      ? Math.round((wonLeads / totalLeads) * 1000) / 10
      : 0

    const response = {
      totalLeads,
      newLeadsThisWeek,
      wonLeads,
      convertedLeads: wonLeads,
      activeLeads: qualifiedLeads,
      totalQualifiedLeads: qualifiedLeads,
      conversionRate,
      leadsChange: 0,
      conversionChange: 0,
      totalTasks: activeTasks + completedTasks + overdueTasks,
      completedTasks,
      pendingTasks: activeTasks,
      overdueTasks,
      taskCompletionRate: 0,
      activeTasks,
      upcomingTasks,
      pendingFollowUps,
      todayFollowUps,
      recentActivities: 0,
      weeklyActivities: 0,
      performanceScore: 0,
      monthlyTarget: 0,
      targetProgress: 0,
      unreadMessages,
      todayAttendance: todayAttendance || {
        status: AttendanceStatus.ABSENT,
        checkIn: null,
        checkOut: null,
        createdAt: null
      }
    }

    return new Response(JSON.stringify(response), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'private, max-age=60'
      }
    })
  } catch (error) {
    console.error('[API] Employee dashboard stats error:', error)
    return new Response(
      JSON.stringify({
        error: 'Internal Server Error',
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: process.env.NODE_ENV === 'development' ? (error as Error).stack : undefined
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
}

