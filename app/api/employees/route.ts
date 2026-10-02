import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { EmployeeStatus, EmploymentType } from '@prisma/client';
import { hasLegacyRole } from '@/lib/auth/permissions';
import { WORKSPACE_SLUG_HEADER } from '@/lib/api/workspace-slug';
import { resolveCompanyContextFromRequest } from '@/lib/auth/company-membership';
import { withStaffRoute, jsonOk } from '@/lib/api/with-route';
import { nextEmployeeCode, resolveOrgLabels } from '@/lib/hr/employee-id';
import { logEmployeeActivity } from '@/lib/hr/activity';
import '@/types/auth';

/** Employee roster (contact details, org links) — HR admins only, like the pages that use it. */
export const GET = withStaffRoute(async (request, { session, companyId }) => {
  const role = session.user.role as string;
  if (!hasLegacyRole(session, 'ADMIN', 'SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (role === 'SUPER_ADMIN' && !request.headers.get(WORKSPACE_SLUG_HEADER)?.trim()) {
    const employees = await prisma.employee.findMany({ orderBy: { name: 'asc' } });
    return jsonOk(employees);
  }

  if (!companyId) {
    return NextResponse.json({ error: 'Company context required' }, { status: 400 });
  }

  const employees = await prisma.employee.findMany({
    where: { companyId },
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
  if (!hasLegacyRole(session, 'ADMIN', 'SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { companyId } = await resolveCompanyContextFromRequest(session, request);
  const data = await request.json().catch(() => ({}));

  if (!data.name || !data.email) {
    return NextResponse.json({ error: 'Name and email are required' }, { status: 400 });
  }

  // Whitelist writable fields: never let the client set id, userId, role, isApproved, etc.
  const rest = {
    name: String(data.name),
    email: String(data.email).trim().toLowerCase(),
    phone: typeof data.phone === 'string' ? data.phone : '',
    address: data.address && typeof data.address === 'object' ? data.address : {},
    jobTitle: typeof data.jobTitle === 'string' ? data.jobTitle : undefined,
    department: typeof data.department === 'string' ? data.department : undefined,
    ...(data.dateJoined && !Number.isNaN(new Date(data.dateJoined).getTime())
      ? { dateJoined: new Date(data.dateJoined) }
      : {}),
    ...(typeof data.employmentType === 'string' &&
    (Object.values(EmploymentType) as string[]).includes(data.employmentType)
      ? { employmentType: data.employmentType as EmploymentType }
      : {}),
    departmentId: typeof data.departmentId === 'string' && data.departmentId ? data.departmentId : null,
    designationId: typeof data.designationId === 'string' && data.designationId ? data.designationId : null,
    branchId: typeof data.branchId === 'string' && data.branchId ? data.branchId : null,
    managerId: typeof data.managerId === 'string' && data.managerId ? data.managerId : null,
  };

  // Org references must belong to this workspace.
  const [dept, desig, branch, manager] = await Promise.all([
    rest.departmentId
      ? prisma.hrDepartment.findFirst({ where: { id: rest.departmentId, companyId }, select: { id: true } })
      : null,
    rest.designationId
      ? prisma.hrDesignation.findFirst({ where: { id: rest.designationId, companyId }, select: { id: true } })
      : null,
    rest.branchId
      ? prisma.hrBranch.findFirst({ where: { id: rest.branchId, companyId }, select: { id: true } })
      : null,
    rest.managerId
      ? prisma.employee.findFirst({ where: { id: rest.managerId, companyId }, select: { id: true } })
      : null,
  ]);
  if (
    (rest.departmentId && !dept) ||
    (rest.designationId && !desig) ||
    (rest.branchId && !branch) ||
    (rest.managerId && !manager)
  ) {
    return NextResponse.json({ error: 'Invalid department, designation, branch or manager' }, { status: 400 });
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
