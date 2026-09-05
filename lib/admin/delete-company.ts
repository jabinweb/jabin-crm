import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export class CompanyNotFoundError extends Error {
  constructor(companyId: string) {
    super(`Company not found: ${companyId}`);
    this.name = 'CompanyNotFoundError';
  }
}

/**
 * Deletes a company and company-scoped rows that lack onDelete: Cascade,
 * then removes sole-membership users (multi-company users are detached only).
 * Does not DROP an external BYO database — only the Opslane Company row and related data.
 */
export async function deleteCompanyCascade(
  companyId: string
): Promise<{ deletedUserIds: string[]; detachedUserIds: string[] }> {
  return prisma.$transaction(
    async (tx) => {
      const company = await tx.company.findUnique({
        where: { id: companyId },
        select: { id: true },
      });
      if (!company) {
        throw new CompanyNotFoundError(companyId);
      }

      const memberships = await tx.userCompany.findMany({
        where: { companyId },
        select: { userId: true },
      });
      const memberUserIds = Array.from(
        new Set<string>(memberships.map((m) => m.userId))
      );

      const deletedUserIds: string[] = [];
      const detachedUserIds: string[] = [];

      for (const userId of memberUserIds) {
        const otherMemberships = await tx.userCompany.count({
          where: { userId, NOT: { companyId } },
        });
        if (otherMemberships === 0) {
          deletedUserIds.push(userId);
        } else {
          detachedUserIds.push(userId);
        }
      }

      // Clear User pointers at this company (Restrict FKs)
      await tx.user.updateMany({
        where: { companyId },
        data: { companyId: null },
      });
      await tx.user.updateMany({
        where: { primaryCompanyId: companyId },
        data: { primaryCompanyId: null },
      });
      await tx.user.updateMany({
        where: { managedCompanyId: companyId },
        data: { managedCompanyId: null },
      });

      // Break Company → Employee admin cycle before cascade employee delete
      await tx.company.update({
        where: { id: companyId },
        data: { adminId: null },
      });

      await deleteCompanyScopedRestrictData(tx, companyId);

      await tx.userCompanyRole.deleteMany({ where: { companyId } });
      await tx.userCompany.deleteMany({ where: { companyId } });

      if (deletedUserIds.length > 0) {
        await prepareUsersForDelete(tx, deletedUserIds);
        await tx.user.deleteMany({ where: { id: { in: deletedUserIds } } });
      }

      await cleanupEmployeesBeforeCompanyDelete(tx, companyId);

      await tx.company.delete({ where: { id: companyId } });

      return { deletedUserIds, detachedUserIds };
    },
    {
      maxWait: 15_000,
      timeout: 120_000,
    }
  );
}

type Tx = Prisma.TransactionClient;

/**
 * Deletes company-scoped business data from the shared Opslane DB.
 * Does not touch User, UserCompany, or Company rows.
 * Used by full company delete and by BYO migrate cutover.
 */
export async function deleteCompanyScopedRestrictData(tx: Tx, companyId: string) {
  // Inventory / procurement — children before parents
  await tx.stockTransfer.deleteMany({ where: { companyId } });
  await tx.inventoryRecord.deleteMany({ where: { companyId } });

  const products = await tx.product.findMany({
    where: { companyId },
    select: { id: true },
  });
  const productIds = products.map((p) => p.id);

  const locations = await tx.location.findMany({
    where: { companyId },
    select: { id: true },
  });
  const locationIds = locations.map((l) => l.id);

  if (productIds.length > 0 || locationIds.length > 0) {
    await tx.batchItem.deleteMany({
      where: {
        OR: [
          ...(productIds.length > 0 ? [{ productId: { in: productIds } }] : []),
          ...(locationIds.length > 0 ? [{ locationId: { in: locationIds } }] : []),
        ],
      },
    });
  }

  for (const productId of productIds) {
    await tx.product.update({
      where: { id: productId },
      data: {
        supplierId: null,
        locations: { set: [] },
        purchaseOrders: { set: [] },
        salesOrders: { set: [] },
      },
    });
  }

  await tx.purchaseOrder.deleteMany({ where: { companyId } });
  await tx.salesOrder.deleteMany({ where: { companyId } });

  await tx.asset.deleteMany({ where: { companyId } });
  await tx.budget.deleteMany({ where: { companyId } });
  await tx.expense.deleteMany({ where: { companyId } });

  // Leads (Restrict → Company) and rows that Restrict → Lead
  const leads = await tx.lead.findMany({
    where: { companyId },
    select: { id: true },
  });
  const leadIds = leads.map((l) => l.id);
  if (leadIds.length > 0) {
    await tx.emailLog.updateMany({
      where: { leadId: { in: leadIds } },
      data: { leadId: null },
    });
    await tx.calendarEvent.updateMany({
      where: { leadId: { in: leadIds } },
      data: { leadId: null },
    });

    await deleteInvoices(
      tx,
      await tx.invoice.findMany({
        where: { leadId: { in: leadIds } },
        select: { id: true },
      })
    );

    const leadQuotations = await tx.quotation.findMany({
      where: { leadId: { in: leadIds } },
      select: { id: true },
    });
    const leadQuotationIds = leadQuotations.map((q) => q.id);
    if (leadQuotationIds.length > 0) {
      await tx.invoice.updateMany({
        where: { quotationId: { in: leadQuotationIds } },
        data: { quotationId: null },
      });
      await tx.quotation.deleteMany({ where: { id: { in: leadQuotationIds } } });
    }

    await tx.lead.updateMany({
      where: { id: { in: leadIds } },
      data: { convertedClientId: null, employeeId: null },
    });
    await tx.lead.deleteMany({ where: { companyId } });
  }

  await tx.client.deleteMany({ where: { companyId } });

  // Customers (Restrict → Company) and blockers
  const customers = await tx.customer.findMany({
    where: { companyId },
    select: { id: true },
  });
  const customerIds = customers.map((c) => c.id);
  if (customerIds.length > 0) {
    await tx.user.updateMany({
      where: { customerId: { in: customerIds } },
      data: { customerId: null },
    });

    await tx.supportTicket.updateMany({
      where: { customerId: { in: customerIds } },
      data: { equipmentId: null, projectId: null },
    });

    await deleteInvoices(
      tx,
      await tx.invoice.findMany({
        where: { customerId: { in: customerIds } },
        select: { id: true },
      })
    );

    const customerQuotations = await tx.quotation.findMany({
      where: { customerId: { in: customerIds } },
      select: { id: true },
    });
    const customerQuotationIds = customerQuotations.map((q) => q.id);
    if (customerQuotationIds.length > 0) {
      await tx.invoice.updateMany({
        where: { quotationId: { in: customerQuotationIds } },
        data: { quotationId: null },
      });
      await tx.quotation.deleteMany({
        where: { id: { in: customerQuotationIds } },
      });
    }

    // Installations Restrict → Product; remove before products
    await tx.equipmentInstallation.deleteMany({
      where: { customerId: { in: customerIds } },
    });

    await tx.customer.deleteMany({ where: { companyId } });
  }

  // Projects (Restrict → Company); children mostly Cascade from Project
  await tx.project.deleteMany({ where: { companyId } });

  if (productIds.length > 0) {
    await tx.equipmentInstallation.deleteMany({
      where: { productId: { in: productIds } },
    });
    await tx.product.deleteMany({ where: { companyId } });
  }

  await tx.supplier.deleteMany({ where: { companyId } });
  await tx.location.deleteMany({ where: { companyId } });
}

async function deleteInvoices(tx: Tx, invoices: { id: string }[]) {
  const invoiceIds = invoices.map((i) => i.id);
  if (invoiceIds.length === 0) return;
  await tx.payment.updateMany({
    where: { invoiceId: { in: invoiceIds } },
    data: { invoiceId: null },
  });
  await tx.invoice.deleteMany({ where: { id: { in: invoiceIds } } });
}

async function prepareUsersForDelete(tx: Tx, userIds: string[]) {
  await tx.employee.updateMany({
    where: { userId: { in: userIds } },
    data: { userId: null },
  });
  await tx.userSession.deleteMany({ where: { userId: { in: userIds } } });
  await tx.userSettings.deleteMany({ where: { userId: { in: userIds } } });
  await tx.auditLog.updateMany({
    where: { userId: { in: userIds } },
    data: { userId: null },
  });
  await tx.leadActivity.updateMany({
    where: { userId: { in: userIds } },
    data: { userId: null },
  });
  await tx.lead.updateMany({
    where: { assignedToId: { in: userIds } },
    data: { assignedToId: null },
  });
  await tx.deal.updateMany({
    where: { assignedToId: { in: userIds } },
    data: { assignedToId: null },
  });
  await tx.task.updateMany({
    where: { assignedToId: { in: userIds } },
    data: { assignedToId: null },
  });
  await tx.supportTicket.updateMany({
    where: { assignedTechnicianId: { in: userIds } },
    data: { assignedTechnicianId: null },
  });
  await tx.ticketTransferHistory.updateMany({
    where: { fromTechnicianId: { in: userIds } },
    data: { fromTechnicianId: null },
  });
  await tx.employeeSalary.deleteMany({
    where: { createdById: { in: userIds } },
  });
}

/**
 * After BYO migrate succeeds: remove shared copies of migrated data-plane rows
 * (not User / Company / membership). Employees are removed from Opslane so
 * runtime data queries use the tenant DB via getDataPrisma.
 */
export async function purgeCompanyDataPlaneFromShared(
  companyId: string
): Promise<void> {
  await prisma.$transaction(
    async (tx) => {
      await tx.company.update({
        where: { id: companyId },
        data: { adminId: null },
      });
      // Children that can block Customer/Product deletes
      await tx.demoEquipmentMovement.deleteMany({ where: { companyId } });
      await tx.demoEquipmentUnit.deleteMany({ where: { companyId } });
      await tx.customerVisit.deleteMany({ where: { companyId } });
      await tx.visitTag.deleteMany({ where: { companyId } });
      await tx.serviceContract.deleteMany({ where: { companyId } });
      await tx.savedTicketFilter.deleteMany({ where: { companyId } });
      await tx.ticketCustomFieldDef.deleteMany({ where: { companyId } });
      await tx.roadmapItem.deleteMany({ where: { companyId } });
      await tx.supportGroup.deleteMany({ where: { companyId } });
      await tx.knowledgeArticle.deleteMany({ where: { companyId } });
      await tx.supportCannedResponse.deleteMany({ where: { companyId } });
      await tx.slaPolicy.deleteMany({ where: { companyId } });

      await deleteCompanyScopedRestrictData(tx, companyId);
      await cleanupEmployeesBeforeCompanyDelete(tx, companyId);
      await tx.employee.deleteMany({ where: { companyId } });
      await tx.hrDepartment.deleteMany({ where: { companyId } });
      await tx.hrDesignation.deleteMany({ where: { companyId } });
      await tx.hrBranch.deleteMany({ where: { companyId } });
      await tx.announcement.deleteMany({ where: { companyId } });
      const policies = await tx.leavePolicy.findMany({
        where: { companyId },
        select: { id: true },
      });
      const policyIds = policies.map((p) => p.id);
      if (policyIds.length > 0) {
        await tx.leaveBalance.deleteMany({
          where: { policyId: { in: policyIds } },
        });
        await tx.leaveRequest.deleteMany({
          where: { policyId: { in: policyIds } },
        });
      }
      await tx.leavePolicy.deleteMany({ where: { companyId } });
      await tx.companyHoliday.deleteMany({ where: { companyId } });
    },
    { maxWait: 15_000, timeout: 120_000 }
  );
}

/** Clear Restrict FKs that would block Employee cascade when Company is deleted. */
async function cleanupEmployeesBeforeCompanyDelete(tx: Tx, companyId: string) {
  const employees = await tx.employee.findMany({
    where: { companyId },
    select: { id: true },
  });
  const employeeIds = employees.map((e) => e.id);
  if (employeeIds.length === 0) return;

  await tx.employeeMessage.deleteMany({
    where: {
      OR: [
        { senderId: { in: employeeIds } },
        { receiverId: { in: employeeIds } },
      ],
    },
  });

  await tx.companyTaskComment.deleteMany({
    where: { createdBy: { in: employeeIds } },
  });
  await tx.companyTask.updateMany({
    where: { companyId },
    data: { parentTaskId: null },
  });
  await tx.companyTask.deleteMany({ where: { companyId } });

  await tx.attendance.deleteMany({
    where: { employeeId: { in: employeeIds } },
  });

  await tx.leaveRequest.updateMany({
    where: { actionById: { in: employeeIds } },
    data: { actionById: null },
  });

  await tx.leadActivity.updateMany({
    where: { employeeId: { in: employeeIds } },
    data: { employeeId: null },
  });

  await tx.lead.updateMany({
    where: { employeeId: { in: employeeIds } },
    data: { employeeId: null },
  });

  await tx.employee.updateMany({
    where: { companyId },
    data: { managerId: null },
  });
}
