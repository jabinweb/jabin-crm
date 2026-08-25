import { prisma } from '@/lib/prisma';
import type { VisitRecurrenceRule, CustomerVisitStatus } from '@prisma/client';

export interface CreateCustomerData {
  organizationName: string;
  contactPerson: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  industry?: string;
  accountType?: string;
  companyId?: string;
  notes?: string;
  /** ISO 4217; null/omit = use company default on new docs */
  billingCurrency?: string | null;
}

export interface CreateContactData {
  name: string;
  role?: string;
  title?: string;
  specialty?: string;
  email?: string;
  phone?: string;
  departmentId?: string | null;
  isPrimary?: boolean;
  isActive?: boolean;
}

export interface CreateDepartmentData {
  name: string;
  notes?: string;
  sortOrder?: number;
}

export interface CreateVisitData {
  scheduledAt: string | Date;
  notes?: string;
  assignedTechnicianId?: string | null;
  departmentId?: string | null;
  recurrenceRule?: VisitRecurrenceRule;
  recurrenceUntil?: string | Date | null;
  tagIds?: string[];
  contactIds?: string[];
  status?: CustomerVisitStatus;
}

function nextOccurrence(from: Date, rule: VisitRecurrenceRule): Date | null {
  if (rule === 'NONE') return null;
  const d = new Date(from);
  if (rule === 'WEEKLY') {
    d.setDate(d.getDate() + 7);
    return d;
  }
  if (rule === 'MONTHLY') {
    d.setMonth(d.getMonth() + 1);
    return d;
  }
  return null;
}

export class CustomerService {
  async createCustomer(data: CreateCustomerData) {
    const { isCurrencyCode } = await import('@/lib/currency');
    const billingCurrency =
      data.billingCurrency && isCurrencyCode(String(data.billingCurrency).trim().toUpperCase())
        ? String(data.billingCurrency).trim().toUpperCase()
        : null;

    const customer = await prisma.customer.create({
      data: {
        organizationName: data.organizationName,
        contactPerson: data.contactPerson,
        email: data.email,
        phone: data.phone,
        address: data.address,
        city: data.city,
        state: data.state,
        industry: data.industry,
        accountType: data.accountType,
        companyId: data.companyId,
        notes: data.notes,
        billingCurrency,
      },
    });

    await this.logActivity(
      customer.id,
      'UPDATED',
      `Customer record created for ${customer.organizationName}`
    );

    return customer;
  }

  async getCustomerById(id: string) {
    return prisma.customer.findUnique({
      where: { id },
      include: {
        contacts: {
          where: { isActive: true },
          include: { department: { select: { id: true, name: true } } },
          orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }],
        },
        departments: {
          include: {
            contacts: {
              where: { isActive: true },
              orderBy: { name: 'asc' },
            },
            _count: { select: { contacts: true, visits: true } },
          },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        },
        visits: {
          include: {
            tags: { include: { tag: true } },
            contacts: { include: { contact: true } },
            department: { select: { id: true, name: true } },
            assignedTechnician: { select: { id: true, name: true, email: true } },
          },
          orderBy: { scheduledAt: 'desc' },
          take: 50,
        },
        activities: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        equipmentInstallations: {
          include: { product: true },
        },
        supportTickets: {
          orderBy: { createdAt: 'desc' },
          take: 30,
          select: {
            id: true,
            subject: true,
            status: true,
            priority: true,
            createdAt: true,
          },
        },
        projects: {
          orderBy: { updatedAt: 'desc' },
          take: 20,
          select: {
            id: true,
            name: true,
            status: true,
            progress: true,
            updatedAt: true,
          },
        },
        retainers: {
          orderBy: { nextBillAt: 'asc' },
          take: 20,
          select: {
            id: true,
            name: true,
            amount: true,
            currency: true,
            billingCycle: true,
            status: true,
            nextBillAt: true,
          },
        },
        invoices: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            id: true,
            invoiceNumber: true,
            title: true,
            status: true,
            total: true,
            currency: true,
            dueDate: true,
          },
        },
        _count: {
          select: {
            supportTickets: true,
            equipmentInstallations: true,
            contacts: true,
            departments: true,
            visits: true,
            projects: true,
            retainers: true,
            invoices: true,
          },
        },
      },
    });
  }

  async updateCustomer(id: string, data: Partial<CreateCustomerData>) {
    const { isCurrencyCode } = await import('@/lib/currency');
    const payload: Partial<CreateCustomerData> = { ...data };
    if ('billingCurrency' in payload) {
      if (!payload.billingCurrency || payload.billingCurrency === '') {
        payload.billingCurrency = null;
      } else {
        const code = String(payload.billingCurrency).trim().toUpperCase();
        payload.billingCurrency = isCurrencyCode(code) ? code : null;
      }
    }

    const customer = await prisma.customer.update({
      where: { id },
      data: payload,
    });

    await this.logActivity(id, 'UPDATED', `Customer information updated`);
    return customer;
  }

  async addContact(customerId: string, data: CreateContactData) {
    if (data.isPrimary) {
      await prisma.customerContact.updateMany({
        where: { customerId },
        data: { isPrimary: false },
      });
    }

    const contact = await prisma.customerContact.create({
      data: {
        customerId,
        name: data.name,
        role: data.role,
        title: data.title,
        specialty: data.specialty,
        email: data.email,
        phone: data.phone,
        departmentId: data.departmentId || null,
        isPrimary: data.isPrimary ?? false,
        isActive: data.isActive ?? true,
      },
      include: { department: { select: { id: true, name: true } } },
    });

    await this.logActivity(customerId, 'UPDATED', `New contact added: ${contact.name}`);
    return contact;
  }

  async updateContact(customerId: string, contactId: string, data: Partial<CreateContactData>) {
    const existing = await prisma.customerContact.findFirst({
      where: { id: contactId, customerId },
    });
    if (!existing) return null;

    if (data.isPrimary) {
      await prisma.customerContact.updateMany({
        where: { customerId, id: { not: contactId } },
        data: { isPrimary: false },
      });
    }

    const contact = await prisma.customerContact.update({
      where: { id: contactId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.role !== undefined ? { role: data.role } : {}),
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.specialty !== undefined ? { specialty: data.specialty } : {}),
        ...(data.email !== undefined ? { email: data.email } : {}),
        ...(data.phone !== undefined ? { phone: data.phone } : {}),
        ...(data.departmentId !== undefined ? { departmentId: data.departmentId || null } : {}),
        ...(data.isPrimary !== undefined ? { isPrimary: data.isPrimary } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
      include: { department: { select: { id: true, name: true } } },
    });

    await this.logActivity(customerId, 'UPDATED', `Contact updated: ${contact.name}`);
    return contact;
  }

  async deleteContact(customerId: string, contactId: string) {
    const existing = await prisma.customerContact.findFirst({
      where: { id: contactId, customerId },
    });
    if (!existing) return null;

    await prisma.customerContact.delete({ where: { id: contactId } });
    await this.logActivity(customerId, 'UPDATED', `Contact removed: ${existing.name}`);
    return existing;
  }

  async listDepartments(customerId: string) {
    return prisma.customerDepartment.findMany({
      where: { customerId },
      include: {
        contacts: { where: { isActive: true }, orderBy: { name: 'asc' } },
        _count: { select: { contacts: true, visits: true } },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async createDepartment(customerId: string, data: CreateDepartmentData) {
    const dept = await prisma.customerDepartment.create({
      data: {
        customerId,
        name: data.name.trim(),
        notes: data.notes?.trim() || null,
        sortOrder: data.sortOrder ?? 0,
      },
      include: {
        contacts: true,
        _count: { select: { contacts: true, visits: true } },
      },
    });
    await this.logActivity(customerId, 'UPDATED', `Department added: ${dept.name}`);
    return dept;
  }

  async updateDepartment(
    customerId: string,
    departmentId: string,
    data: Partial<CreateDepartmentData>
  ) {
    const existing = await prisma.customerDepartment.findFirst({
      where: { id: departmentId, customerId },
    });
    if (!existing) return null;

    const dept = await prisma.customerDepartment.update({
      where: { id: departmentId },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.notes !== undefined ? { notes: data.notes?.trim() || null } : {}),
        ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
      },
      include: {
        contacts: { where: { isActive: true }, orderBy: { name: 'asc' } },
        _count: { select: { contacts: true, visits: true } },
      },
    });
    await this.logActivity(customerId, 'UPDATED', `Department updated: ${dept.name}`);
    return dept;
  }

  async deleteDepartment(customerId: string, departmentId: string) {
    const existing = await prisma.customerDepartment.findFirst({
      where: { id: departmentId, customerId },
    });
    if (!existing) return null;

    await prisma.customerContact.updateMany({
      where: { departmentId },
      data: { departmentId: null },
    });
    await prisma.customerDepartment.delete({ where: { id: departmentId } });
    await this.logActivity(customerId, 'UPDATED', `Department removed: ${existing.name}`);
    return existing;
  }

  async listVisits(customerId: string) {
    return prisma.customerVisit.findMany({
      where: { customerId },
      include: {
        tags: { include: { tag: true } },
        contacts: { include: { contact: true } },
        department: { select: { id: true, name: true } },
        assignedTechnician: { select: { id: true, name: true, email: true } },
      },
      orderBy: { scheduledAt: 'desc' },
      take: 100,
    });
  }

  async createVisit(customerId: string, companyId: string, data: CreateVisitData, createdById?: string) {
    const scheduledAt = new Date(data.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime())) {
      throw new Error('Invalid scheduledAt');
    }

    const visit = await prisma.customerVisit.create({
      data: {
        customerId,
        companyId,
        scheduledAt,
        notes: data.notes?.trim() || null,
        assignedTechnicianId: data.assignedTechnicianId || null,
        departmentId: data.departmentId || null,
        recurrenceRule: data.recurrenceRule || 'NONE',
        recurrenceUntil: data.recurrenceUntil ? new Date(data.recurrenceUntil) : null,
        status: data.status || 'SCHEDULED',
        createdById: createdById || null,
        tags: data.tagIds?.length
          ? { create: data.tagIds.map((tagId) => ({ tagId })) }
          : undefined,
        contacts: data.contactIds?.length
          ? { create: data.contactIds.map((contactId) => ({ contactId })) }
          : undefined,
      },
      include: {
        tags: { include: { tag: true } },
        contacts: { include: { contact: true } },
        department: { select: { id: true, name: true } },
        assignedTechnician: { select: { id: true, name: true, email: true } },
      },
    });

    await this.logActivity(
      customerId,
      'VISIT',
      `Visit scheduled for ${scheduledAt.toLocaleString()}`
    );
    return visit;
  }

  async updateVisit(
    customerId: string,
    visitId: string,
    data: Partial<CreateVisitData> & { status?: CustomerVisitStatus }
  ) {
    const existing = await prisma.customerVisit.findFirst({
      where: { id: visitId, customerId },
    });
    if (!existing) return null;

    const wasCompleted = existing.status === 'COMPLETED';
    const nextStatus = data.status;

    await prisma.$transaction(async (tx) => {
      if (data.tagIds) {
        await tx.customerVisitTag.deleteMany({ where: { visitId } });
        if (data.tagIds.length) {
          await tx.customerVisitTag.createMany({
            data: data.tagIds.map((tagId) => ({ visitId, tagId })),
          });
        }
      }
      if (data.contactIds) {
        await tx.customerVisitContact.deleteMany({ where: { visitId } });
        if (data.contactIds.length) {
          await tx.customerVisitContact.createMany({
            data: data.contactIds.map((contactId) => ({ visitId, contactId })),
          });
        }
      }

      await tx.customerVisit.update({
        where: { id: visitId },
        data: {
          ...(data.scheduledAt !== undefined
            ? { scheduledAt: new Date(data.scheduledAt) }
            : {}),
          ...(data.notes !== undefined ? { notes: data.notes?.trim() || null } : {}),
          ...(data.assignedTechnicianId !== undefined
            ? { assignedTechnicianId: data.assignedTechnicianId || null }
            : {}),
          ...(data.departmentId !== undefined
            ? { departmentId: data.departmentId || null }
            : {}),
          ...(data.recurrenceRule !== undefined
            ? { recurrenceRule: data.recurrenceRule }
            : {}),
          ...(data.recurrenceUntil !== undefined
            ? {
                recurrenceUntil: data.recurrenceUntil
                  ? new Date(data.recurrenceUntil)
                  : null,
              }
            : {}),
          ...(nextStatus !== undefined ? { status: nextStatus } : {}),
        },
      });
    });

    // When completing a recurring visit, spawn the next occurrence
    if (nextStatus === 'COMPLETED' && !wasCompleted && existing.recurrenceRule !== 'NONE') {
      const nextAt = nextOccurrence(existing.scheduledAt, existing.recurrenceRule);
      const until = existing.recurrenceUntil;
      if (nextAt && (!until || nextAt.getTime() <= until.getTime())) {
        const priorTags = await prisma.customerVisitTag.findMany({
          where: { visitId },
          select: { tagId: true },
        });
        const priorContacts = await prisma.customerVisitContact.findMany({
          where: { visitId },
          select: { contactId: true },
        });
        await prisma.customerVisit.create({
          data: {
            customerId: existing.customerId,
            companyId: existing.companyId,
            scheduledAt: nextAt,
            notes: existing.notes,
            assignedTechnicianId: existing.assignedTechnicianId,
            departmentId: existing.departmentId,
            recurrenceRule: existing.recurrenceRule,
            recurrenceUntil: existing.recurrenceUntil,
            status: 'SCHEDULED',
            createdById: existing.createdById,
            tags: priorTags.length
              ? { create: priorTags.map((t) => ({ tagId: t.tagId })) }
              : undefined,
            contacts: priorContacts.length
              ? { create: priorContacts.map((c) => ({ contactId: c.contactId })) }
              : undefined,
          },
        });
        await this.logActivity(
          customerId,
          'VISIT',
          `Next recurring visit scheduled for ${nextAt.toLocaleString()}`
        );
      }
    }

    const visit = await prisma.customerVisit.findUnique({
      where: { id: visitId },
      include: {
        tags: { include: { tag: true } },
        contacts: { include: { contact: true } },
        department: { select: { id: true, name: true } },
        assignedTechnician: { select: { id: true, name: true, email: true } },
      },
    });

    if (nextStatus) {
      await this.logActivity(customerId, 'VISIT', `Visit marked ${nextStatus}`);
    }

    return visit;
  }

  async deleteVisit(customerId: string, visitId: string) {
    const existing = await prisma.customerVisit.findFirst({
      where: { id: visitId, customerId },
    });
    if (!existing) return null;
    await prisma.customerVisit.delete({ where: { id: visitId } });
    await this.logActivity(customerId, 'VISIT', `Visit deleted`);
    return existing;
  }

  async logActivity(customerId: string, eventType: string, description: string, metadata?: any) {
    return prisma.customerActivity.create({
      data: {
        customerId,
        eventType,
        description,
        metadata: metadata || {},
      },
    });
  }

  async listCustomers(params: {
    search?: string;
    city?: string;
    page?: number;
    limit?: number;
    companyId?: string;
  }) {
    const { search, city, page = 1, limit = 10, companyId } = params;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (companyId) {
      where.companyId = companyId;
    }
    if (search) {
      where.OR = [
        { organizationName: { contains: search, mode: 'insensitive' } },
        { contactPerson: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (city) {
      where.city = city;
    }

    const [total, customers] = await Promise.all([
      prisma.customer.count({ where }),
      prisma.customer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { organizationName: 'asc' },
        include: {
          _count: {
            select: {
              equipmentInstallations: true,
              supportTickets: true,
              contacts: true,
              visits: true,
            },
          },
        },
      }),
    ]);

    return {
      customers,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

export const customerService = new CustomerService();
