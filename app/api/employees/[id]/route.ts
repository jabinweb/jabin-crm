import { handleRouteError } from '@/lib/api/tenant-response';
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { NextRequest } from 'next/server'
import { WORKSPACE_SLUG_HEADER } from '@/lib/api/workspace-slug'
import {
  resolveCompanyContextFromRequest,
  TenantError,
} from '@/lib/auth/company-membership'

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

    const employee = await prisma.employee.findUnique({
      where: { id },
    });

    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    const role = (session.user as any).role as string
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

    const id = (await params).id
    const role = (session.user as any).role as string
    const hasWorkspace = request.headers.get(WORKSPACE_SLUG_HEADER)?.trim()

    if (role !== 'SUPER_ADMIN' || hasWorkspace) {
      const { companyId } = await resolveCompanyContextFromRequest(session, request)
      const existing = await prisma.employee.findFirst({ where: { id, companyId } })
      if (!existing) {
        return new Response(JSON.stringify({ error: 'Not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        })
      }
    }

    const body = await request.json()

    const employee = await prisma.employee.update({
      where: { id },
      data: body,
      include: {
        user: true
      }
    })

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
