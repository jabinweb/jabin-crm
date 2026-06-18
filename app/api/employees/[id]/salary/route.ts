import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { handleRouteError } from '@/lib/api/tenant-response';
import { prisma } from '@/lib/prisma'
import {
  resolveCompanyContextFromRequest,
  TenantError,
} from '@/lib/auth/company-membership'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 })
    }

    const { companyId } = await resolveCompanyContextFromRequest(session, req)
    const employeeId = (await params).id

    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, companyId },
    })
    if (!employee) {
      return new Response('Not found', { status: 404 })
    }

    const salary = await prisma.employeeSalary.findFirst({
      where: { employeeId },
      orderBy: { effectiveFrom: 'desc' },
      select: {
        id: true,
        basicSalary: true,
        houseRent: true,
        transport: true,
        medicalAllowance: true,
        taxDeduction: true,
        otherDeductions: true,
        effectiveFrom: true,
      },
    })

    return new Response(JSON.stringify(salary), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    if (error instanceof TenantError) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: error.status,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    console.error('Salary fetch error:', error)
    return new Response('Internal Server Error', { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 })
    }

    const { companyId } = await resolveCompanyContextFromRequest(session, req)
    const data = await req.json()
    const employeeId = (await params).id

    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, companyId },
    })

    if (!employee) {
      return new Response('Employee not found', { status: 404 })
    }

    const salary = await prisma.employeeSalary.create({
      data: {
        employee: { connect: { id: employeeId } },
        createdBy: { connect: { id: session.user.id } },
        basicSalary: Number(data.basicSalary),
        houseRent: Number(data.houseRent),
        transport: Number(data.transport),
        medicalAllowance: Number(data.medicalAllowance),
        taxDeduction: Number(data.taxDeduction),
        otherDeductions: Number(data.otherDeductions),
        effectiveFrom: new Date(),
      },
    })

    return new Response(JSON.stringify(salary), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    if (error instanceof TenantError) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: error.status,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    console.error('Salary creation error:', error)
    return new Response('Internal Server Error', { status: 500 })
  }
}
