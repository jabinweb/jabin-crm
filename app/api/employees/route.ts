// /app/api/employees/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { EmployeeStatus } from "@prisma/client";
import { WORKSPACE_SLUG_HEADER } from "@/lib/api/workspace-slug";
import {
  resolveCompanyContextFromRequest,
  TenantError,
} from "@/lib/auth/company-membership";
import "@/types/auth";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = (session.user as any).role as string;
    let employees;

    if (role === "SUPER_ADMIN" && !request.headers.get(WORKSPACE_SLUG_HEADER)?.trim()) {
      employees = await prisma.employee.findMany({
        orderBy: { name: "asc" },
      });
    } else {
      const { companyId } = await resolveCompanyContextFromRequest(session, request);
      employees = await prisma.employee.findMany({
        where: {
          companyId,
          ...(session.user.employeeId
            ? { NOT: { id: session.user.employeeId } }
            : {}),
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          avatar: true,
          department: true,
          dateJoined: true,
          status: true,
        },
        orderBy: { name: "asc" },
      });
    }

    return NextResponse.json(employees);
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error fetching employees:", error);
    return NextResponse.json({ error: "Failed to fetch employees" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { companyId } = await resolveCompanyContextFromRequest(session, request);
    const data = await request.json();
    const { companyId: _strip, ...rest } = data;

    if (!data.name || !data.email) {
      return NextResponse.json(
        { error: "Name and email are required" },
        { status: 400 }
      );
    }

    const employee = await prisma.employee.create({
      data: {
        ...rest,
        companyId,
        status: EmployeeStatus.ACTIVE,
      },
    });

    return NextResponse.json(employee, { status: 201 });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error(
      "Error creating employee:",
      error instanceof Error ? error.message : error
    );
    return NextResponse.json({ error: "Failed to create employee" }, { status: 500 });
  }
}
