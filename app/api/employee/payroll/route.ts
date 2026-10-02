import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.employeeId) {
      return new Response('Unauthorized', { status: 401 })
    }

    const searchParams = req.nextUrl.searchParams
    const year = parseInt(searchParams.get('year') || '', 10) || new Date().getFullYear()
    // Payslip.month is 1–12; only filter when the caller asks for a month.
    const month = parseInt(searchParams.get('month') || '', 10)

    const payslips = await prisma.payslip.findMany({
      where: {
        employeeId: session.user.employeeId,
        year: year,
        month: month >= 1 && month <= 12 ? month : undefined
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return new Response(JSON.stringify(payslips), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('[API] Payroll error:', error)
    return new Response('Internal Server Error', { status: 500 })
  }
}

