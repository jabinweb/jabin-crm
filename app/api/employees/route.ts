import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { EmployeeStatus } from '@prisma/client';
import { WORKSPACE_SLUG_HEADER } from '@/lib/api/workspace-slug';
import { resolveCompanyContextFromRequest } from '@/lib/auth/company-membership';
import { withStaffRoute, jsonOk } from '@/lib/api/with-route';
import '@/types/auth';

export const GET = withStaffRoute(async (request, { session, companyId }) => {
  const role = session.user.role as string;

  if (role === 'SUPER_ADMIN' && !request.headers.get(WORKSPACE_SLUG_HEADER)?.trim()) {
    const employees = await prisma.employee.findMany({ orderBy: { name: 'asc' } });
    return jsonOk(employees);
  }

  if (!companyId) {
    return NextResponse.json({ error: 'Company context required' }, { status: 400 });
  }

  const employees = await prisma.employee.findMany({
    where: {
      companyId,
      ...(session.user.employeeId ? { NOT: { id: session.user.employeeId } } : {}),
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
    orderBy: { name: 'asc' },
  });

  return jsonOk(employees);
});

export const POST = withStaffRoute(async (request, { session }) => {
  const { companyId } = await resolveCompanyContextFromRequest(session, request);
  const data = await request.json();
  const { companyId: _strip, ...rest } = data;

  if (!data.name || !data.email) {
    return NextResponse.json({ error: 'Name and email are required' }, { status: 400 });
  }

  const employee = await prisma.employee.create({
    data: {
      ...rest,
      companyId,
      status: EmployeeStatus.ACTIVE,
    },
  });

  return jsonOk(employee, { status: 201 });
});
