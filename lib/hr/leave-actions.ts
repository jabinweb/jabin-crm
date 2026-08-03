import { prisma } from '@/lib/prisma'
import { logEmployeeActivity } from '@/lib/hr/activity'

export type LeaveAction = 'approve' | 'reject'

export async function processLeaveAction(input: {
  leaveRequestId: string
  action: LeaveAction
  comment?: string | null
  actorEmployeeId?: string | null
}) {
  const existingRequest = await prisma.leaveRequest.findUnique({
    where: { id: input.leaveRequestId },
    include: {
      employee: { select: { name: true, companyId: true, managerId: true } },
    },
  })

  if (!existingRequest) {
    throw Object.assign(new Error('Leave request not found'), { status: 404 })
  }
  if (existingRequest.status !== 'PENDING') {
    throw Object.assign(new Error('Leave request already processed'), { status: 400 })
  }

  const days = existingRequest.days || 1
  const year = existingRequest.startDate.getFullYear()

  const updatedRequest = await prisma.$transaction(async (tx) => {
    if (existingRequest.policyId) {
      const balance = await tx.leaveBalance.findUnique({
        where: {
          employeeId_policyId_year: {
            employeeId: existingRequest.employeeId,
            policyId: existingRequest.policyId,
            year,
          },
        },
      })
      if (balance) {
        const nextPending = Math.max(0, balance.pending - days)
        if (input.action === 'approve') {
          await tx.leaveBalance.update({
            where: { id: balance.id },
            data: {
              pending: nextPending,
              used: balance.used + days,
            },
          })
        } else {
          await tx.leaveBalance.update({
            where: { id: balance.id },
            data: { pending: nextPending },
          })
        }
      }
    }

    return tx.leaveRequest.update({
      where: { id: input.leaveRequestId },
      data: {
        status: input.action === 'approve' ? 'APPROVED' : 'REJECTED',
        comment: input.comment ?? null,
        actionById: input.actorEmployeeId ?? null,
        actionAt: new Date(),
        updatedAt: new Date(),
      },
    })
  })

  await logEmployeeActivity({
    employeeId: existingRequest.employeeId,
    actorId: input.actorEmployeeId,
    type: input.action === 'approve' ? 'LEAVE_APPROVED' : 'LEAVE_REJECTED',
    message:
      input.action === 'approve'
        ? `Leave approved (${days} day(s))`
        : `Leave rejected (${days} day(s))`,
    meta: { leaveRequestId: existingRequest.id, days },
  })

  return { updatedRequest, existingRequest }
}
