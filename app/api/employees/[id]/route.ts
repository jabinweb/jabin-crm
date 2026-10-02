import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { NextRequest } from 'next/server'
import { WORKSPACE_SLUG_HEADER } from '@/lib/api/workspace-slug'
import {
  resolveCompanyContextFromRequest,
  TenantError,
} from '@/lib/auth/company-membership'
import { resolveOrgLabels } from '@/lib/hr/employee-id'
import { logEmployeeActivity } from '@/lib/hr/activity'
import { hasLegacyRole } from '@/lib/auth/permissions'
import type { Prisma } from '@prisma/client'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const id = (await params).id
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!hasLegacyRole(session, 'ADMIN', 'SUPER_ADMIN')) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const employee = await prisma.employee.findUnique({
      where: { id },
      include: {
        hrDepartment: { select: { id: true, name: true } },
        designation: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
        manager: { select: { id: true, name: true } },
      },
    });

    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    const role = (session.user as { role?: string }).role as string
    if (role === 'SUPER_ADMIN' && !request.headers.get(WORKSPACE_SLUG_HEADER)?.trim()) {
      return NextResponse.json(employee);
    }

    const { companyId } = await resolveCompanyContextFromRequest(session, request)
    if (employee.companyId !== companyId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(employee);
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error("Error fetching employee:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch employee",
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const session = await auth()
    if (!session?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (!hasLegacyRole(session, 'ADMIN', 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const id = (await params).id
    const role = (session.user as { role?: string }).role as string
    const hasWorkspace = request.headers.get(WORKSPACE_SLUG_HEADER)?.trim()

    const existing = await prisma.employee.findUnique({ where: { id } })
    if (!existing) {
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (role !== 'SUPER_ADMIN' || hasWorkspace) {
      const { companyId } = await resolveCompanyContextFromRequest(session, request)
      if (existing.companyId !== companyId) {
        return new Response(JSON.stringify({ error: 'Not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        })
      }
    }

    const raw = await request.json().catch(() => ({}))
    // Only HR-editable profile fields; never id/companyId/userId/employeeId/isApproved etc.
    const EDITABLE = [
      'name', 'email', 'phone', 'address', 'jobTitle', 'department', 'avatar',
      'employmentType', 'status', 'role', 'dateJoined', 'dateOfBirth', 'gender',
      'emergencyContact', 'customFields',
      'departmentId', 'designationId', 'branchId', 'managerId',
    ] as const
    const body: Record<string, unknown> = {}
    for (const key of EDITABLE) {
      if (raw && typeof raw === 'object' && key in raw) body[key] = (raw as Record<string, unknown>)[key]
    }
    for (const key of ['dateJoined', 'dateOfBirth'] as const) {
      if (body[key] != null) {
        const d = new Date(body[key] as string)
        if (Number.isNaN(d.getTime())) {
          return NextResponse.json({ error: `Invalid ${key}` }, { status: 400 })
        }
        body[key] = d
      }
    }
    if (body.managerId === id) {
      return NextResponse.json({ error: 'An employee cannot be their own manager' }, { status: 400 })
    }
    const refChecks: Array<Promise<unknown>> = [
      body.departmentId
        ? prisma.hrDepartment.findFirst({ where: { id: String(body.departmentId), companyId: existing.companyId }, select: { id: true } })
        : Promise.resolve(true),
      body.designationId
        ? prisma.hrDesignation.findFirst({ where: { id: String(body.designationId), companyId: existing.companyId }, select: { id: true } })
        : Promise.resolve(true),
      body.branchId
        ? prisma.hrBranch.findFirst({ where: { id: String(body.branchId), companyId: existing.companyId }, select: { id: true } })
        : Promise.resolve(true),
      body.managerId
        ? prisma.employee.findFirst({ where: { id: String(body.managerId), companyId: existing.companyId }, select: { id: true } })
        : Promise.resolve(true),
    ]
    if ((await Promise.all(refChecks)).some((r) => !r)) {
      return NextResponse.json(
        { error: 'Invalid department, designation, branch or manager' },
        { status: 400 }
      )
    }

    const labels = await resolveOrgLabels({
      departmentId:
        body.departmentId !== undefined ? (body.departmentId as string | null) : existing.departmentId,
      designationId:
        body.designationId !== undefined ? (body.designationId as string | null) : existing.designationId,
      department: body.department as string | undefined,
      jobTitle: body.jobTitle as string | undefined,
    })

    const employee = await prisma.employee.update({
      where: { id },
      data: {
        ...(body as unknown as Prisma.EmployeeUncheckedUpdateInput),
        ...(labels.department ? { department: labels.department } : {}),
        ...(labels.jobTitle ? { jobTitle: labels.jobTitle } : {}),
      },
      include: {
        // Never return the linked user's password hash / tokens
        user: { select: { id: true, name: true, email: true, role: true, image: true } },
        hrDepartment: { select: { id: true, name: true } },
        designation: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
        manager: { select: { id: true, name: true } },
      }
    })

    if (body.status && body.status !== existing.status) {
      await logEmployeeActivity({
        employeeId: id,
        actorId: session.user.employeeId,
        type: 'STATUS_CHANGE',
        message: `Status changed to ${body.status}`,
        meta: { from: existing.status, to: body.status },
      })
    }

    return new Response(JSON.stringify(employee), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    if (error instanceof TenantError) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: error.status,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    console.error('Employee update error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to update employee',
      details: error instanceof Error ? error.message : undefined
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }>}
): Promise<Response> {
  try {
    const id = (await params).id
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({
        error: "Unauthorized",
        message: "You must be logged in to delete an employee"
      }, { status: 401 });
    }
    if (!hasLegacyRole(session, 'ADMIN', 'SUPER_ADMIN')) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { companyId } = await resolveCompanyContextFromRequest(session, request)

    const employee = await prisma.employee.findUnique({
      where: {
        id,
        companyId,
      },
      select: {
        avatar: true,
      }
    });

    if (!employee) {
      return NextResponse.json({
        error: "Not found",
        message: "Employee not found"
      }, { status: 404 });
    }

    await prisma.employee.delete({
      where: {
        id,
        companyId,
      },
    });

    return NextResponse.json({
      message: "Employee deleted successfully"
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error("Error deleting employee:", error);
    return NextResponse.json({
      error: "Failed to delete employee",
      message: "An error occurred while deleting the employee"
    }, { status: 500 });
  }
}
