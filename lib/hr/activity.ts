import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'

export async function logEmployeeActivity(input: {
  employeeId: string
  actorId?: string | null
  type: string
  message: string
  meta?: Record<string, unknown> | null
}) {
  try {
    await prisma.employeeActivity.create({
      data: {
        employeeId: input.employeeId,
        actorId: input.actorId ?? null,
        type: input.type,
        message: input.message,
        meta: (input.meta ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    })
  } catch (error) {
    console.error('[employee-activity]', error)
  }
}
