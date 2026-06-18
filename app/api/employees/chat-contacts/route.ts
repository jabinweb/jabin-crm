import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from '@/auth'
import { handleRouteError } from '@/lib/api/tenant-response';
import {
  resolveCompanyContextFromRequest,
  TenantError,
} from "@/lib/auth/company-membership"

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { companyId } = await resolveCompanyContextFromRequest(session, request)
    const currentUserId = session.user.employeeId

    const employees = await prisma.employee.findMany({
      where: {
        companyId,
        status: { notIn: ['TERMINATED', 'SUSPENDED'] },
        ...(currentUserId ? { id: { not: currentUserId } } : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        department: true,
        status: true,
      },
      orderBy: {
        name: 'asc',
      },
    })

    return NextResponse.json({ success: true, data: employees })
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('Error fetching chat contacts:', error)
    return NextResponse.json({ error: "Failed to fetch contacts" }, { status: 500 })
  }
}
