import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export interface ServiceReportPartLine {
  productId: string;
  quantity: number;
}

export interface CreateServiceReportData {
  ticketId: string;
  technicianId: string;
  serviceNotes: string;
  partsReplaced?: string;
  parts?: ServiceReportPartLine[];
  nextMaintenanceDate?: Date;
  attachments?: Record<string, unknown>;
  customerSignerName?: string;
  signedAt?: Date;
  signatureDataUrl?: string;
}

function mergeAttachments(
  base: Record<string, unknown> | undefined,
  partsLines: Array<{ productId: string; quantity: number; name: string; sku?: string | null }>
): Prisma.InputJsonValue {
  return {
    ...(base || {}),
    partsLines,
  } as Prisma.InputJsonValue;
}

export class ServiceReportService {
  /**
   * Create a new service report for a ticket.
   * When `parts` are provided, decrements product stock in the same transaction.
   */
  async createReport(data: CreateServiceReportData) {
    const parts = (data.parts || []).filter((p) => p.productId && Number(p.quantity) > 0);

    const report = await prisma.$transaction(async (tx) => {
      const ticket = await tx.supportTicket.findUnique({
        where: { id: data.ticketId },
        include: { customer: true },
      });
      if (!ticket) throw new Error('Ticket not found');

      const companyId = ticket.customer.companyId;
      const resolvedParts: Array<{
        productId: string;
        quantity: number;
        name: string;
        sku?: string | null;
      }> = [];

      if (parts.length > 0) {
        if (!companyId) throw new Error('Ticket customer has no company');

        for (const line of parts) {
          const qty = Math.floor(Number(line.quantity));
          if (!Number.isFinite(qty) || qty <= 0) {
            throw new Error('Each part line needs a positive quantity');
          }

          const product = await tx.product.findFirst({
            where: { id: line.productId, companyId },
          });
          if (!product) throw new Error(`Product not found: ${line.productId}`);
          if (product.quantity < qty) {
            throw new Error(
              `Insufficient stock for ${product.name}. Available: ${product.quantity}`
            );
          }

          await tx.inventoryRecord.create({
            data: {
              type: 'SERVICE_OUT',
              quantity: qty,
              price: product.price ?? 0,
              productId: product.id,
              companyId,
              reason: `Service report for ticket ${ticket.subject}`,
              notes: `ticketId=${ticket.id}`,
            },
          });

          await tx.product.update({
            where: { id: product.id },
            data: { quantity: { decrement: qty } },
          });

          resolvedParts.push({
            productId: product.id,
            quantity: qty,
            name: product.name,
            sku: product.sku,
          });
        }
      }

      const partsLabel =
        data.partsReplaced?.trim() ||
        (resolvedParts.length
          ? resolvedParts.map((p) => `${p.name} x${p.quantity}`).join(', ')
          : undefined);

      const created = await tx.serviceReport.create({
        data: {
          ticketId: data.ticketId,
          technicianId: data.technicianId,
          serviceNotes: data.serviceNotes,
          partsReplaced: partsLabel,
          nextMaintenanceDate: data.nextMaintenanceDate,
          attachments: mergeAttachments(data.attachments, resolvedParts),
          customerSignerName: data.customerSignerName || null,
          signedAt: data.signedAt || (data.signatureDataUrl ? new Date() : null),
          signatureDataUrl: data.signatureDataUrl || null,
        },
        include: {
          ticket: {
            include: {
              customer: true,
            },
          },
          technician: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      return created;
    });

    // Resolve ticket via updateStatus so visit limits / photo evidence apply
    const { ticketService } = await import('@/lib/crm/ticket-service');
    try {
      await ticketService.updateStatus(data.ticketId, 'RESOLVED', data.technicianId);
    } catch (err) {
      // Roll back report if resolve blocked (stock already moved — re-stock best-effort)
      await this.rollbackReportStock(report.id).catch(() => null);
      await prisma.serviceReport.delete({ where: { id: report.id } }).catch(() => null);
      throw err;
    }

    await prisma.ticketActivity.create({
      data: {
        ticketId: data.ticketId,
        eventType: 'SERVICE_REPORT',
        description: `Service report filed by technician. Ticket marked as RESOLVED.`,
        performedById: data.technicianId,
        metadata: { reportId: report.id },
      },
    });

    await prisma.customerActivity.create({
      data: {
        customerId: report.ticket.customerId,
        eventType: 'SERVICE_REPORT',
        description: `Service report received for ticket: ${report.ticket.subject}`,
        metadata: { reportId: report.id, ticketId: data.ticketId },
      },
    });

    return report;
  }

  private async rollbackReportStock(reportId: string) {
    const report = await prisma.serviceReport.findUnique({ where: { id: reportId } });
    if (!report?.attachments || typeof report.attachments !== 'object') return;
    const attachments = report.attachments as { partsLines?: ServiceReportPartLine[] };
    const lines = attachments.partsLines || [];
    if (!lines.length) return;

    await prisma.$transaction(async (tx) => {
      for (const line of lines) {
        await tx.product.update({
          where: { id: line.productId },
          data: { quantity: { increment: line.quantity } },
        });
      }
    });
  }

  /**
   * List service reports for a tenant company (via ticket → customer).
   */
  async listReportsForCompany(companyId: string) {
    return prisma.serviceReport.findMany({
      where: { ticket: { customer: { companyId } } },
      include: {
        technician: {
          select: { id: true, name: true, email: true },
        },
        ticket: {
          select: {
            id: true,
            subject: true,
            status: true,
            customer: {
              select: { id: true, organizationName: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get reports for a specific ticket
   */
  async getReportsByTicket(ticketId: string) {
    return await prisma.serviceReport.findMany({
      where: { ticketId },
      include: {
        technician: {
          select: { name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get a specific report by ID
   */
  async getReportById(id: string) {
    return await prisma.serviceReport.findUnique({
      where: { id },
      include: {
        ticket: {
          include: {
            customer: true,
            equipment: { include: { product: true } },
          },
        },
        technician: {
          select: { name: true, email: true },
        },
      },
    });
  }

  async acknowledgeReport(
    id: string,
    data: { customerSignerName: string; signatureDataUrl: string }
  ) {
    return prisma.serviceReport.update({
      where: { id },
      data: {
        customerSignerName: data.customerSignerName,
        signatureDataUrl: data.signatureDataUrl,
        signedAt: new Date(),
      },
    });
  }
}

export const serviceReportService = new ServiceReportService();
