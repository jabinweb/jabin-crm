import { prisma } from '@/lib/prisma';
import type { GlobalSearchEntityType, GlobalSearchResult } from '@/lib/crm/global-search-types';

export type { GlobalSearchEntityType, GlobalSearchResult } from '@/lib/crm/global-search-types';

const PER_TYPE = 6;

function contains(query: string) {
  return { contains: query, mode: 'insensitive' as const };
}

/**
 * Workspace-scoped search across CRM entities.
 * Returns a flat list (callers can group by `type`).
 */
export async function globalSearch(
  companyId: string,
  rawQuery: string,
  options?: { limitPerType?: number }
): Promise<GlobalSearchResult[]> {
  const q = rawQuery.trim();
  if (q.length < 2) return [];

  const take = options?.limitPerType ?? PER_TYPE;
  const text = contains(q);

  const [
    leads,
    customers,
    employees,
    tickets,
    deals,
    products,
    invoices,
    contracts,
    equipment,
    projects,
    retainers,
  ] = await Promise.all([
    prisma.lead.findMany({
      where: {
        companyId,
        OR: [
          { companyName: text },
          { contactName: text },
          { name: text },
          { email: text },
          { phone: text },
        ],
      },
      select: {
        id: true,
        companyName: true,
        contactName: true,
        name: true,
        email: true,
        phone: true,
        status: true,
      },
      orderBy: { updatedAt: 'desc' },
      take,
    }),
    prisma.customer.findMany({
      where: {
        companyId,
        OR: [
          { organizationName: text },
          { contactPerson: text },
          { email: text },
          { phone: text },
          { city: text },
        ],
      },
      select: {
        id: true,
        organizationName: true,
        contactPerson: true,
        email: true,
        phone: true,
        city: true,
      },
      orderBy: { updatedAt: 'desc' },
      take,
    }),
    prisma.employee.findMany({
      where: {
        companyId,
        OR: [
          { name: text },
          { email: text },
          { phone: text },
          { employeeId: text },
          { jobTitle: text },
          { department: text },
        ],
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        employeeId: true,
        jobTitle: true,
        department: true,
        status: true,
      },
      orderBy: { updatedAt: 'desc' },
      take,
    }),
    prisma.supportTicket.findMany({
      where: {
        customer: { companyId },
        OR: [
          { subject: text },
          { description: text },
          { id: { equals: q } },
          { customer: { organizationName: text } },
        ],
      },
      select: {
        id: true,
        subject: true,
        status: true,
        priority: true,
        customer: { select: { organizationName: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take,
    }),
    prisma.deal.findMany({
      where: {
        lead: { companyId },
        OR: [
          { title: text },
          { notes: text },
          { lead: { companyName: text } },
        ],
      },
      select: {
        id: true,
        title: true,
        stage: true,
        value: true,
        currency: true,
        lead: { select: { companyName: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take,
    }),
    prisma.product.findMany({
      where: {
        companyId,
        OR: [
          { name: text },
          { sku: text },
          { modelNumber: text },
          { manufacturer: text },
          { barcode: text },
          { category: text },
        ],
      },
      select: {
        id: true,
        name: true,
        sku: true,
        modelNumber: true,
        manufacturer: true,
        category: true,
      },
      orderBy: { updatedAt: 'desc' },
      take,
    }),
    prisma.invoice.findMany({
      where: {
        OR: [
          { lead: { companyId } },
          { customer: { companyId } },
          { user: { primaryCompanyId: companyId } },
          { user: { userCompanies: { some: { companyId } } } },
        ],
        AND: [
          {
            OR: [
              { invoiceNumber: text },
              { title: text },
              { customerName: text },
              { customerEmail: text },
              { gstin: text },
            ],
          },
        ],
      },
      select: {
        id: true,
        invoiceNumber: true,
        title: true,
        customerName: true,
        status: true,
        total: true,
        currency: true,
      },
      orderBy: { updatedAt: 'desc' },
      take,
    }),
    prisma.serviceContract.findMany({
      where: {
        companyId,
        OR: [
          { title: text },
          { contractNumber: text },
          { customer: { organizationName: text } },
        ],
      },
      select: {
        id: true,
        title: true,
        contractNumber: true,
        type: true,
        status: true,
        customer: { select: { organizationName: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take,
    }),
    prisma.equipmentInstallation.findMany({
      where: {
        customer: { companyId },
        OR: [
          { serialNumber: text },
          { notes: text },
          { product: { name: text } },
          { product: { modelNumber: text } },
          { customer: { organizationName: text } },
        ],
      },
      select: {
        id: true,
        serialNumber: true,
        status: true,
        customerId: true,
        product: { select: { name: true, modelNumber: true } },
        customer: { select: { organizationName: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take,
    }),
    prisma.project.findMany({
      where: {
        companyId,
        OR: [{ name: text }, { description: text }],
      },
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        progress: true,
        customer: { select: { organizationName: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take,
    }),
    prisma.clientRetainer.findMany({
      where: {
        companyId,
        OR: [
          { name: text },
          { description: text },
          { customer: { organizationName: text } },
        ],
      },
      select: {
        id: true,
        name: true,
        status: true,
        amount: true,
        currency: true,
        billingCycle: true,
        customer: { select: { organizationName: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take,
    }),
  ]);

  const results: GlobalSearchResult[] = [];

  for (const lead of leads) {
    results.push({
      id: lead.id,
      type: 'lead',
      title: lead.companyName || lead.name || 'Lead',
      subtitle: [lead.contactName || lead.name, lead.email, lead.phone]
        .filter(Boolean)
        .join(' · '),
      href: `/dashboard/leads/${lead.id}`,
      meta: lead.status,
    });
  }

  for (const customer of customers) {
    results.push({
      id: customer.id,
      type: 'customer',
      title: customer.organizationName,
      subtitle: [customer.contactPerson, customer.email, customer.phone, customer.city]
        .filter(Boolean)
        .join(' · '),
      href: `/dashboard/customers/${customer.id}`,
    });
  }

  for (const employee of employees) {
    results.push({
      id: employee.id,
      type: 'employee',
      title: employee.name,
      subtitle: [employee.employeeId, employee.jobTitle, employee.department, employee.email]
        .filter(Boolean)
        .join(' · '),
      href: `/dashboard/employees/${employee.id}`,
      meta: employee.status,
    });
  }

  for (const ticket of tickets) {
    results.push({
      id: ticket.id,
      type: 'ticket',
      title: ticket.subject,
      subtitle: ticket.customer.organizationName,
      href: `/dashboard/tickets/${ticket.id}`,
      meta: ticket.status,
    });
  }

  for (const deal of deals) {
    results.push({
      id: deal.id,
      type: 'deal',
      title: deal.title,
      subtitle: [
        deal.lead?.companyName,
        deal.value != null ? `${deal.currency} ${deal.value}` : null,
      ]
        .filter(Boolean)
        .join(' · '),
      href: `/dashboard/deals/${deal.id}`,
      meta: deal.stage,
    });
  }

  for (const product of products) {
    results.push({
      id: product.id,
      type: 'product',
      title: product.name,
      subtitle: [product.sku, product.modelNumber, product.manufacturer, product.category]
        .filter(Boolean)
        .join(' · '),
      href: `/dashboard/products/${product.id}`,
    });
  }

  for (const invoice of invoices) {
    results.push({
      id: invoice.id,
      type: 'invoice',
      title: invoice.invoiceNumber || invoice.title,
      subtitle: [invoice.customerName, `${invoice.currency} ${invoice.total}`]
        .filter(Boolean)
        .join(' · '),
      href: `/dashboard/invoices/${invoice.id}`,
      meta: invoice.status,
    });
  }

  for (const contract of contracts) {
    results.push({
      id: contract.id,
      type: 'contract',
      title: contract.contractNumber || contract.title,
      subtitle: [contract.title !== contract.contractNumber ? contract.title : null, contract.customer.organizationName]
        .filter(Boolean)
        .join(' · '),
      href: `/dashboard/contracts/${contract.id}`,
      meta: `${contract.type} · ${contract.status}`,
    });
  }

  for (const unit of equipment) {
    results.push({
      id: unit.id,
      type: 'equipment',
      title: unit.product.name,
      subtitle: [
        unit.serialNumber ? `S/N ${unit.serialNumber}` : null,
        unit.product.modelNumber,
        unit.customer.organizationName,
      ]
        .filter(Boolean)
        .join(' · '),
      href: `/dashboard/customers/${unit.customerId}`,
      meta: unit.status,
    });
  }

  for (const project of projects) {
    results.push({
      id: project.id,
      type: 'project',
      title: project.name,
      subtitle: [
        project.customer?.organizationName,
        project.description?.slice(0, 80) || null,
      ]
        .filter(Boolean)
        .join(' · '),
      href: `/dashboard/projects/${project.id}`,
      meta: `${project.status} · ${project.progress}%`,
    });
  }

  for (const retainer of retainers) {
    results.push({
      id: retainer.id,
      type: 'retainer',
      title: retainer.name,
      subtitle: [
        retainer.customer.organizationName,
        `${retainer.currency} ${retainer.amount}/${retainer.billingCycle.toLowerCase()}`,
      ]
        .filter(Boolean)
        .join(' · '),
      href: `/dashboard/retainers`,
      meta: retainer.status,
    });
  }

  return results;
}
