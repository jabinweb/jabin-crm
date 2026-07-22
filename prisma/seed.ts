import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { ensureFreePlan, ensureFreeTrialSubscription } from '../lib/subscription/ensure-free-trial';
import { PLAN_CATALOG, PLAN_LIST_PRICES_PAISE } from '../lib/pricing/catalog';
import { DEFAULT_PLAN_MODULES } from '../lib/plan-modules';
import { ensureRbacCatalog, syncUserRoleAssignment } from '../lib/auth/rbac-catalog';

const DEMO_SLUG = 'jabin-international-private-limited';
const DEMO_PASSWORD = 'Demo@12345';

async function syncPlans() {
  for (const key of Object.keys(PLAN_CATALOG) as Array<keyof typeof PLAN_CATALOG>) {
    const catalog = PLAN_CATALOG[key];
    const price = PLAN_LIST_PRICES_PAISE[key] ?? catalog.pricePaise;
    const modules = DEFAULT_PLAN_MODULES[key] ?? {};
    await prisma.plan.upsert({
      where: { name: catalog.name },
      create: {
        name: catalog.name,
        displayName: catalog.displayName,
        description: catalog.description,
        price,
        currency: 'INR',
        interval: catalog.interval,
        maxLeads: catalog.maxLeads,
        maxEmails: catalog.maxEmails,
        maxCampaigns: catalog.maxCampaigns,
        features: [...catalog.features],
        modules,
        isActive: true,
      },
      update: {
        displayName: catalog.displayName,
        description: catalog.description,
        price,
        features: [...catalog.features],
        modules,
        isActive: true,
      },
    });
  }
  await ensureFreePlan();
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set');
  }

  console.log('Seeding demo workspace…');
  await syncPlans();
  console.log('Plans synced');

  const company = await prisma.company.upsert({
    where: { slug: DEMO_SLUG },
    create: {
      name: 'Jabin International Private Limited',
      slug: DEMO_SLUG,
      email: 'ops@jabininternational.example',
      phone: '+91 98765 43210',
      status: 'APPROVED',
      settings: {
        onboarding: { completed: true, skipped: false },
        businessVertical: 'field_service',
      },
    },
    update: {
      status: 'APPROVED',
      settings: {
        onboarding: { completed: true, skipped: false },
        businessVertical: 'field_service',
      },
    },
  });

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@jabininternational.example' },
    create: {
      email: 'admin@jabininternational.example',
      name: 'Priya Sharma',
      password: passwordHash,
      role: 'ADMIN',
      userStatus: 'ACTIVE',
      companyId: company.id,
      primaryCompanyId: company.id,
    },
    update: {
      password: passwordHash,
      role: 'ADMIN',
      userStatus: 'ACTIVE',
      companyId: company.id,
      primaryCompanyId: company.id,
    },
  });

  await prisma.userCompany.upsert({
    where: {
      userId_companyId: { userId: adminUser.id, companyId: company.id },
    },
    create: { userId: adminUser.id, companyId: company.id },
    update: {},
  });

  const salesUser = await prisma.user.upsert({
    where: { email: 'sales@jabininternational.example' },
    create: {
      email: 'sales@jabininternational.example',
      name: 'Arjun Mehta',
      password: passwordHash,
      role: 'SALES',
      userStatus: 'ACTIVE',
      companyId: company.id,
      primaryCompanyId: company.id,
    },
    update: {
      password: passwordHash,
      companyId: company.id,
      primaryCompanyId: company.id,
    },
  });

  await prisma.userCompany.upsert({
    where: {
      userId_companyId: { userId: salesUser.id, companyId: company.id },
    },
    create: { userId: salesUser.id, companyId: company.id },
    update: {},
  });

  const techUser = await prisma.user.upsert({
    where: { email: 'tech@jabininternational.example' },
    create: {
      email: 'tech@jabininternational.example',
      name: 'Rahul Nair',
      password: passwordHash,
      role: 'TECHNICIAN',
      userStatus: 'ACTIVE',
      companyId: company.id,
      primaryCompanyId: company.id,
    },
    update: {
      password: passwordHash,
      companyId: company.id,
      primaryCompanyId: company.id,
    },
  });

  await prisma.userCompany.upsert({
    where: {
      userId_companyId: { userId: techUser.id, companyId: company.id },
    },
    create: { userId: techUser.id, companyId: company.id },
    update: {},
  });

  const supportUser = await prisma.user.upsert({
    where: { email: 'support@jabininternational.example' },
    create: {
      email: 'support@jabininternational.example',
      name: 'Neha Kapoor',
      password: passwordHash,
      role: 'SUPPORT_MANAGER',
      userStatus: 'ACTIVE',
      companyId: company.id,
      primaryCompanyId: company.id,
    },
    update: {
      password: passwordHash,
      role: 'SUPPORT_MANAGER',
      userStatus: 'ACTIVE',
      companyId: company.id,
      primaryCompanyId: company.id,
    },
  });

  await prisma.userCompany.upsert({
    where: {
      userId_companyId: { userId: supportUser.id, companyId: company.id },
    },
    create: { userId: supportUser.id, companyId: company.id },
    update: {},
  });

  const adminEmployee = await prisma.employee.upsert({
    where: { email: 'admin@jabininternational.example' },
    create: {
      employeeId: 'EMP-ADMIN-001',
      name: 'Priya Sharma',
      email: 'admin@jabininternational.example',
      phone: '+91 98765 43210',
      address: { city: 'Bengaluru', state: 'KA', country: 'IN' },
      jobTitle: 'Operations Admin',
      department: 'Admin',
      role: 'ADMIN',
      employmentType: 'FULL_TIME',
      status: 'ACTIVE',
      isApproved: true,
      companyId: company.id,
      userId: adminUser.id,
    },
    update: {
      status: 'ACTIVE',
      isApproved: true,
      userId: adminUser.id,
      companyId: company.id,
    },
  });

  const salesEmployee = await prisma.employee.upsert({
    where: { email: 'sales@jabininternational.example' },
    create: {
      employeeId: 'EMP-SALES-001',
      name: 'Arjun Mehta',
      email: 'sales@jabininternational.example',
      phone: '+91 98765 11111',
      address: { city: 'Bengaluru', state: 'KA', country: 'IN' },
      jobTitle: 'Sales Executive',
      department: 'Sales',
      role: 'EMPLOYEE',
      employmentType: 'FULL_TIME',
      status: 'ACTIVE',
      isApproved: true,
      companyId: company.id,
      userId: salesUser.id,
    },
    update: {
      status: 'ACTIVE',
      isApproved: true,
      userId: salesUser.id,
      companyId: company.id,
    },
  });

  const techEmployee = await prisma.employee.upsert({
    where: { email: 'tech@jabininternational.example' },
    create: {
      employeeId: 'EMP-TECH-001',
      name: 'Rahul Nair',
      email: 'tech@jabininternational.example',
      phone: '+91 98765 22222',
      address: { city: 'Mysuru', state: 'KA', country: 'IN' },
      jobTitle: 'Field Technician',
      department: 'Service',
      role: 'EMPLOYEE',
      employmentType: 'FULL_TIME',
      status: 'ACTIVE',
      isApproved: true,
      companyId: company.id,
      userId: techUser.id,
    },
    update: {
      status: 'ACTIVE',
      isApproved: true,
      userId: techUser.id,
      companyId: company.id,
    },
  });

  await prisma.employee.upsert({
    where: { email: 'leave@jabininternational.example' },
    create: {
      employeeId: 'EMP-HR-002',
      name: 'Sneha Iyer',
      email: 'leave@jabininternational.example',
      phone: '+91 98765 33333',
      address: { city: 'Bengaluru', state: 'KA', country: 'IN' },
      jobTitle: 'HR Associate',
      department: 'People',
      role: 'EMPLOYEE',
      employmentType: 'FULL_TIME',
      status: 'ACTIVE',
      isApproved: true,
      companyId: company.id,
    },
    update: {
      status: 'ACTIVE',
      isApproved: true,
      companyId: company.id,
    },
  });

  if (!company.adminId) {
    await prisma.company.update({
      where: { id: company.id },
      data: { adminId: adminEmployee.id },
    });
  }

  const customerSpecs = [
    {
      organizationName: 'Fortis Diagnostics Hub',
      contactPerson: 'Dr. Ananya Rao',
      email: 'ananya@fortisdiag.example',
      phone: '+91 80 4000 1001',
      city: 'Bengaluru',
      state: 'Karnataka',
      industry: 'Healthcare',
    },
    {
      organizationName: 'MedCare Hospitals',
      contactPerson: 'Vikram Sethi',
      email: 'vikram@medcare.example',
      phone: '+91 80 4000 2002',
      city: 'Hyderabad',
      state: 'Telangana',
      industry: 'Healthcare',
    },
    {
      organizationName: 'City Imaging Center',
      contactPerson: 'Neha Kapoor',
      email: 'neha@cityimaging.example',
      phone: '+91 22 4000 3003',
      city: 'Mumbai',
      state: 'Maharashtra',
      industry: 'Diagnostics',
    },
  ];

  const customers = [];
  for (const c of customerSpecs) {
    const existing = await prisma.customer.findFirst({
      where: { companyId: company.id, organizationName: c.organizationName },
    });
    customers.push(
      existing ??
        (await prisma.customer.create({
          data: { ...c, companyId: company.id },
        }))
    );
  }

  const portalCustomer = customers[0];
  if (portalCustomer) {
    const portalUser = await prisma.user.upsert({
      where: { email: 'portal@fortisdiag.example' },
      create: {
        email: 'portal@fortisdiag.example',
        name: portalCustomer.contactPerson,
        password: passwordHash,
        role: 'CUSTOMER',
        userStatus: 'ACTIVE',
        companyId: company.id,
        primaryCompanyId: company.id,
        customerId: portalCustomer.id,
      },
      update: {
        password: passwordHash,
        role: 'CUSTOMER',
        userStatus: 'ACTIVE',
        companyId: company.id,
        primaryCompanyId: company.id,
        customerId: portalCustomer.id,
      },
    });
    console.log(`  Portal: portal@fortisdiag.example → customer ${portalCustomer.organizationName} (${portalUser.id})`);
  }

  const leadSpecs = [
    {
      companyName: 'Apollo Clinics North',
      contactName: 'Ravi Menon',
      email: 'ravi@apollo.example',
      phone: '+91 98700 10001',
      city: 'Chennai',
      status: 'NEW' as const,
      priority: 'HIGH' as const,
      source: 'Website',
      sourceType: 'WEBSITE' as const,
    },
    {
      companyName: 'Lifeline Labs',
      contactName: 'Meera Joshi',
      email: 'meera@lifeline.example',
      phone: '+91 98700 10002',
      city: 'Pune',
      status: 'CONTACTED' as const,
      priority: 'MEDIUM' as const,
      source: 'Referral',
      sourceType: 'REFERRAL' as const,
    },
    {
      companyName: 'Orbit Imaging',
      contactName: 'Sanjay Pillai',
      email: 'sanjay@orbit.example',
      phone: '+91 98700 10003',
      city: 'Kochi',
      status: 'QUALIFIED' as const,
      priority: 'HIGH' as const,
      source: 'Trade show',
      sourceType: 'EVENT' as const,
    },
  ];

  for (const lead of leadSpecs) {
    const exists = await prisma.lead.findFirst({
      where: { companyId: company.id, companyName: lead.companyName },
    });
    if (!exists) {
      await prisma.lead.create({
        data: {
          ...lead,
          userId: salesUser.id,
          companyId: company.id,
        },
      });
    }
  }

  const orbit = await prisma.lead.findFirst({
    where: { companyId: company.id, companyName: 'Orbit Imaging' },
  });
  if (orbit) {
    const activityToday = await prisma.leadActivity.findFirst({
      where: {
        leadId: orbit.id,
        userId: adminUser.id,
        createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      },
    });
    if (!activityToday) {
      await prisma.leadActivity.create({
        data: {
          leadId: orbit.id,
          activityType: 'NOTE_ADDED',
          description: 'Follow-up call scheduled with procurement.',
          userId: adminUser.id,
          employeeId: adminEmployee.id,
        },
      });
    }
  }

  for (let i = 0; i < customers.length; i++) {
    const customer = customers[i];
    const subject =
      i === 0
        ? 'CT suite calibration overdue'
        : i === 1
          ? 'UPS alarm on ICU floor'
          : 'Preventive visit — MRI chiller';
    const existingTicket = await prisma.supportTicket.findFirst({
      where: { customerId: customer.id, subject },
    });
    if (!existingTicket) {
      await prisma.supportTicket.create({
        data: {
          customerId: customer.id,
          subject,
          description: 'Seeded demo ticket for dashboard testing.',
          priority: i === 0 ? 'HIGH' : 'MEDIUM',
          status: i === 2 ? 'IN_PROGRESS' : 'OPEN',
          channel: 'PORTAL',
          assignedTechnicianId: techUser.id,
          responseDueAt: new Date(Date.now() + 4 * 60 * 60 * 1000),
          resolutionDueAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
    }
  }

  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  async function ensureAttendance(
    employeeId: string,
    data: { status: 'PRESENT' | 'LATE' | 'ABSENT'; checkIn?: Date; checkOut?: Date | null }
  ) {
    const existing = await prisma.attendance.findFirst({
      where: {
        employeeId,
        createdAt: {
          gte: dayStart,
          lt: new Date(dayStart.getTime() + 24 * 60 * 60 * 1000),
        },
      },
    });
    if (existing) {
      await prisma.attendance.update({
        where: { id: existing.id },
        data: {
          status: data.status,
          checkIn: data.checkIn ?? existing.checkIn,
          checkOut: data.checkOut === undefined ? existing.checkOut : data.checkOut,
        },
      });
      return;
    }
    await prisma.attendance.create({
      data: {
        employeeId,
        status: data.status,
        checkIn: data.checkIn ?? null,
        checkOut: data.checkOut ?? null,
        createdAt: new Date(dayStart.getTime() + 9 * 60 * 60 * 1000),
      },
    });
  }

  const lateIn = new Date(dayStart);
  lateIn.setHours(10, 35, 0, 0);
  const onTime = new Date(dayStart);
  onTime.setHours(9, 5, 0, 0);

  await ensureAttendance(adminEmployee.id, { status: 'PRESENT', checkIn: onTime });
  await ensureAttendance(salesEmployee.id, { status: 'LATE', checkIn: lateIn });
  await ensureAttendance(techEmployee.id, { status: 'PRESENT', checkIn: onTime });

  const leaveEmp = await prisma.employee.findUnique({
    where: { email: 'leave@jabininternational.example' },
  });
  if (leaveEmp) {
    const leaveExists = await prisma.leaveRequest.findFirst({
      where: {
        employeeId: leaveEmp.id,
        startDate: { lte: now },
        endDate: { gte: dayStart },
        status: 'APPROVED',
      },
    });
    if (!leaveExists) {
      await prisma.leaveRequest.create({
        data: {
          employeeId: leaveEmp.id,
          startDate: dayStart,
          endDate: new Date(dayStart.getTime() + 2 * 24 * 60 * 60 * 1000),
          type: 'Casual',
          reason: 'Family function',
          status: 'APPROVED',
          actionById: adminEmployee.id,
          actionAt: now,
        },
      });
    }
  }

  for (let i = 0; i < customers.length; i++) {
    const customer = customers[i];
    const title =
      i === 0 ? 'AMC — Imaging suite 2026' : i === 1 ? 'CMC — Critical power' : 'AMC — Chiller plant';
    const existing = await prisma.serviceContract.findFirst({
      where: { companyId: company.id, customerId: customer.id, title },
    });
    if (!existing) {
      const end = new Date();
      end.setDate(end.getDate() + (i === 0 ? 12 : i === 1 ? 40 : 90));
      await prisma.serviceContract.create({
        data: {
          companyId: company.id,
          customerId: customer.id,
          title,
          type: i === 1 ? 'CMC' : 'AMC',
          status: 'ACTIVE',
          startDate: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000),
          endDate: end,
          annualValue: 150000 + i * 50000,
          currency: 'INR',
          includesParts: i === 1,
          reminderDays: 45,
        },
      });
    }
  }

  console.log('\nDemo workspace ready');
  console.log(`  URL:   /${DEMO_SLUG}/dashboard`);
  console.log('  Admin:   admin@jabininternational.example');
  console.log('  Sales:   sales@jabininternational.example');
  console.log('  Tech:    tech@jabininternational.example');
  console.log('  Support: support@jabininternational.example');
  console.log('  Portal:  portal@fortisdiag.example');
  console.log(`  Pass:    ${DEMO_PASSWORD}`);

  try {
    await ensureRbacCatalog();
    for (const u of [adminUser, salesUser, techUser, supportUser]) {
      await syncUserRoleAssignment(u.id, u.role);
    }
    console.log('  RBAC roles/permissions synced');
  } catch (e) {
    console.warn('  RBAC seed skipped:', e);
  }

  try {
    await ensureFreeTrialSubscription(adminUser.id);
    console.log('  Admin free trial subscription attached');
  } catch (e) {
    console.warn('  Could not attach trial subscription:', e);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
