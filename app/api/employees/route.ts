import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { EmployeeStatus } from '@prisma/client';
import { WORKSPACE_SLUG_HEADER } from '@/lib/api/workspace-slug';
import { resolveCompanyContextFromRequest } from '@/lib/auth/company-membership';
import { withStaffRoute, jsonOk } from '@/lib/api/with-route';
import { nextEmployeeCode, resolveOrgLabels } from '@/lib/hr/employee-id';
import { logEmployeeActivity } from '@/lib/hr/activity';
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
      employeeId: true,
      jobTitle: true,
      managerId: true,
      departmentId: true,
      designationId: true,
      branchId: true,
    },
    orderBy: { name: 'asc' },
  });

  return jsonOk(employees);
});

export const POST = withStaffRoute(async (request, { session }) => {
  const { companyId } = await resolveCompanyContextFromRequest(session, request);
  const data = await request.json();
  const { companyId: _strip, employeeId: _eid, ...rest } = data;

  if (!data.name || !data.email) {
    return NextResponse.json({ error: 'Name and email are required' }, { status: 400 });
  }

  const code = await nextEmployeeCode(companyId);
  const labels = await resolveOrgLabels({
    departmentId: rest.departmentId,
    designationId: rest.designationId,
    department: rest.department,
    jobTitle: rest.jobTitle,
  });

  const employee = await prisma.employee.create({
    data: {
      ...rest,
      companyId,
      employeeId: code,
      department: labels.department || rest.department || 'General',
      jobTitle: labels.jobTitle || rest.jobTitle || 'Employee',
      status: EmployeeStatus.ACTIVE,
      departmentId: rest.departmentId || null,
      designationId: rest.designationId || null,
      branchId: rest.branchId || null,
      managerId: rest.managerId || null,
    },
  });

  await logEmployeeActivity({
    employeeId: employee.id,
    actorId: session.user.employeeId,
    type: 'CREATED',
    message: `Employee created (${code})`,
  });

  return jsonOk(employee, { status: 201 });
});
