import { prisma } from '@/lib/prisma';
import logger from '@/lib/logger';
import { Prisma } from '@prisma/client';
import type { Quotation, QuotationItem, QuotationStatus } from '@prisma/client';
import { ApiErrors } from '@/lib/api-error-handler';

export interface CreateQuotationInput {
  userId: string;
  leadId?: string;
  dealId?: string;
  customerId?: string;
  title: string;
  description?: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  customerAddress?: string;
  currency?: string;
  taxRate?: number;
  discount?: number;
  validityDays?: number;
  terms?: string;
  notes?: string;
  items: Array<{
    name: string;
    description?: string;
    quantity: number;
    unitPrice: number;
  }>;
}

export interface UpdateQuotationInput {
  title?: string;
  currency?: string;
  description?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerAddress?: string;
  taxRate?: number;
  discount?: number;
  validityDays?: number;
  terms?: string;
  notes?: string;
  items?: Array<{
    name: string;
    description?: string;
    quantity: number;
    unitPrice: number;
  }>;
}

export class QuotationService {
  /**
   * Generate a unique quotation number
   */
  private async generateQuotationNumber(): Promise<string> {
    const prefix = 'QT';
    const year = new Date().getFullYear().toString().slice(-2);
    const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
    
    const lastQuotation = await prisma.quotation.findFirst({
      where: {
        quotationNumber: {
          startsWith: `${prefix}${year}${month}`,
        },
      },
      // Highest number, not most recent row
      orderBy: {
        quotationNumber: 'desc',
      },
    });

    let sequence = 1;
    if (lastQuotation) {
      const lastSequence = parseInt(lastQuotation.quotationNumber.slice(`${prefix}${year}${month}`.length), 10);
      sequence = (Number.isFinite(lastSequence) ? lastSequence : 0) + 1;
    }

    return `${prefix}${year}${month}${sequence.toString().padStart(4, '0')}`;
  }

  /**
   * Calculate quotation totals
   */
  private calculateTotals(
    items: Array<{ quantity: number; unitPrice: number }>,
    taxRate: number = 0,
    discount: number = 0
  ) {
    const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const taxAmount = subtotal * (taxRate / 100);
    const total = subtotal + taxAmount - discount;

    return {
      subtotal: Math.round(subtotal * 100) / 100,
      taxAmount: Math.round(taxAmount * 100) / 100,
      total: Math.round(total * 100) / 100,
    };
  }

  /**
   * Create a new quotation
   */
  async createQuotation(input: CreateQuotationInput) {
    try {
      const { subtotal, taxAmount, total } = this.calculateTotals(
        input.items,
        input.taxRate || 0,
        input.discount || 0
      );

      const validUntil = input.validityDays
        ? new Date(Date.now() + input.validityDays * 24 * 60 * 60 * 1000)
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // Default 30 days

      const { resolveBillingCustomerId } = await import('@/lib/api/portal-billing-scope');
      const { resolveDocumentCurrency } = await import('@/lib/currency/resolve-document');
      const customerId = await resolveBillingCustomerId({
        customerId: input.customerId,
        customerEmail: input.customerEmail,
        userId: input.userId,
      });

      const currency = await resolveDocumentCurrency({
        explicit: input.currency,
        customerId,
        customerEmail: input.customerEmail,
        userId: input.userId,
      });

      // Quotation numbers are globally unique; retry when a concurrent create took ours.
      const createWithNumber = async () => {
        const quotationNumber = await this.generateQuotationNumber();
        return prisma.quotation.create({
        data: {
          quotationNumber,
          userId: input.userId,
          leadId: input.leadId,
          dealId: input.dealId,
          customerId: customerId || null,
          title: input.title,
          description: input.description,
          customerName: input.customerName,
          customerEmail: input.customerEmail,
          customerPhone: input.customerPhone,
          customerAddress: input.customerAddress,
          currency,
          subtotal,
          taxRate: input.taxRate || 0,
          taxAmount,
          discount: input.discount || 0,
          total,
          validUntil,
          terms: input.terms,
          notes: input.notes,
          status: 'DRAFT',
          items: {
            create: input.items.map((item) => ({
              name: item.name,
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              amount: Math.round(item.quantity * item.unitPrice * 100) / 100,
            })),
          },
        },
        include: {
          items: true,
          lead: true,
          deal: true,
        },
      });
      };

      let quotation!: Awaited<ReturnType<typeof createWithNumber>>;
      for (let attempt = 0; ; attempt++) {
        try {
          quotation = await createWithNumber();
          break;
        } catch (err) {
          const isNumberClash =
            err instanceof Prisma.PrismaClientKnownRequestError &&
            err.code === 'P2002' &&
            JSON.stringify(err.meta ?? {}).includes('quotationNumber');
          if (!isNumberClash || attempt >= 4) throw err;
        }
      }

      logger.info({
        quotationId: quotation.id,
        quotationNumber: quotation.quotationNumber,
        userId: input.userId,
      }, 'Quotation created');

      return quotation;
    } catch (error) {
      logger.error({ error, input }, 'Failed to create quotation');
      throw error;
    }
  }

  /**
   * Update an existing quotation
   */
  async updateQuotation(quotationId: string, input: UpdateQuotationInput) {
    try {
      const existing = await prisma.quotation.findUnique({
        where: { id: quotationId },
        include: { items: true },
      });

      if (!existing) {
        throw ApiErrors.notFound('Quotation');
      }

      if (existing.status !== 'DRAFT') {
        throw ApiErrors.badRequest('Only draft quotations can be edited');
      }

      let updateData: any = {
        title: input.title,
        description: input.description,
        customerName: input.customerName,
        customerEmail: input.customerEmail,
        customerPhone: input.customerPhone,
        customerAddress: input.customerAddress,
        currency: input.currency,
        taxRate: input.taxRate,
        discount: input.discount,
        terms: input.terms,
        notes: input.notes,
        ...(input.validityDays
          ? { validUntil: new Date(Date.now() + input.validityDays * 24 * 60 * 60 * 1000) }
          : {}),
      };

      // Recalculate totals when items, tax rate or discount change
      if (input.items || input.taxRate !== undefined || input.discount !== undefined) {
        const { subtotal, taxAmount, total } = this.calculateTotals(
          input.items ?? existing.items,
          input.taxRate ?? existing.taxRate,
          input.discount ?? existing.discount
        );

        updateData = {
          ...updateData,
          subtotal,
          taxAmount,
          total,
        };
      }

      const quotation = await prisma.quotation.update({
        where: { id: quotationId },
        data: {
          ...updateData,
          ...(input.items && {
            items: {
              // Replace items atomically with the quotation update
              deleteMany: {},
              create: input.items.map((item) => ({
                name: item.name,
                description: item.description,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                amount: Math.round(item.quantity * item.unitPrice * 100) / 100,
              })),
            },
          }),
        },
        include: {
          items: true,
          lead: true,
          deal: true,
        },
      });

      logger.info({ quotationId }, 'Quotation updated');

      return quotation;
    } catch (error) {
      logger.error({ error, quotationId }, 'Failed to update quotation');
      throw error;
    }
  }

  /**
   * Send quotation to customer
   */
  async sendQuotation(quotationId: string) {
    try {
      const existing = await prisma.quotation.findUnique({
        where: { id: quotationId },
        select: { status: true },
      });
      if (!existing) throw ApiErrors.notFound('Quotation');

      const quotation = await prisma.quotation.update({
        where: { id: quotationId },
        data: {
          // Re-sending must not move an accepted/converted quotation back to SENT
          status: existing.status === 'DRAFT' ? 'SENT' : existing.status,
          sentAt: new Date(),
        },
        include: {
          items: true,
          lead: true,
          deal: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              profile: true,
            },
          },
        },
      });

      logger.info({ quotationId }, 'Quotation sent');

      // Send email with PDF attachment
      await this.sendQuotationEmail(quotation);

      return quotation;
    } catch (error) {
      logger.error({ error, quotationId }, 'Failed to send quotation');
      throw error;
    }
  }

  /**
   * Send quotation email with PDF attachment
   */
  private async sendQuotationEmail(quotation: any) {
    try {
      const { sendQuotationEmail } = await import('@/lib/email/quotation-email');
      await sendQuotationEmail(quotation);
    } catch (error) {
      logger.error({ error, quotationId: quotation.id }, 'Failed to send quotation email');
      // Don't throw - quotation is already marked as sent
    }
  }

  /**
   * Mark quotation as accepted
   */
  async acceptQuotation(quotationId: string) {
    try {
      const existing = await prisma.quotation.findUnique({
        where: { id: quotationId },
        select: { status: true },
      });
      if (!existing) throw ApiErrors.notFound('Quotation');
      if (existing.status === 'CONVERTED') {
        throw ApiErrors.badRequest('Quotation has already been converted to an invoice');
      }

      const quotation = await prisma.quotation.update({
        where: { id: quotationId },
        data: {
          status: 'ACCEPTED',
          acceptedAt: new Date(),
        },
        include: {
          items: true,
        },
      });

      logger.info({ quotationId }, 'Quotation accepted');

      return quotation;
    } catch (error) {
      logger.error({ error, quotationId }, 'Failed to accept quotation');
      throw error;
    }
  }

  /**
   * Mark quotation as rejected
   */
  async rejectQuotation(quotationId: string, reason?: string) {
    try {
      const quotation = await prisma.quotation.update({
        where: { id: quotationId },
        data: {
          status: 'REJECTED',
          rejectedAt: new Date(),
          ...(reason
            ? { notes: `Rejection reason: ${reason}` }
            : {}),
        },
        include: {
          items: true,
        },
      });

      logger.info({ quotationId }, 'Quotation rejected');

      return quotation;
    } catch (error) {
      logger.error({ error, quotationId }, 'Failed to reject quotation');
      throw error;
    }
  }

  /**
   * Convert quotation to invoice
   */
  async convertToInvoice(quotationId: string, dueInDays: number = 30) {
    try {
      const quotation = await prisma.quotation.findUnique({
        where: { id: quotationId },
        include: { items: true },
      });

      if (!quotation) {
        throw ApiErrors.notFound('Quotation');
      }

      if (quotation.status !== 'ACCEPTED') {
        throw ApiErrors.badRequest('Only accepted quotations can be converted to invoices');
      }

      // Check if quotation is already converted
      const existingInvoice = await prisma.invoice.findUnique({
        where: { quotationId: quotation.id },
      });
      
      if (existingInvoice) {
        throw ApiErrors.conflict('Quotation already converted to invoice');
      }

      // Import invoice service to avoid circular dependency
      const { InvoiceService } = await import('@/lib/crm/invoice-service');
      const invoiceService = new InvoiceService();

      const invoice = await invoiceService.createInvoice({
        userId: quotation.userId,
        leadId: quotation.leadId || undefined,
        dealId: quotation.dealId || undefined,
        customerId: quotation.customerId || undefined,
        quotationId: quotation.id,
        title: quotation.title,
        description: quotation.description || undefined,
        customerName: quotation.customerName,
        customerEmail: quotation.customerEmail,
        customerPhone: quotation.customerPhone || undefined,
        customerAddress: quotation.customerAddress || undefined,
        currency: quotation.currency,
        taxRate: quotation.taxRate,
        discount: quotation.discount,
        dueInDays,
        terms: quotation.terms || undefined,
        notes: quotation.notes || undefined,
        items: quotation.items.map((item) => ({
          name: item.name,
          description: item.description || undefined,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
      });

      // Mark quotation as converted
      await prisma.quotation.update({
        where: { id: quotationId },
        data: { status: 'CONVERTED' },
      });

      logger.info({
        quotationId,
        invoiceId: invoice.id,
      }, 'Quotation converted to invoice');

      return invoice;
    } catch (error) {
      logger.error({ error, quotationId }, 'Failed to convert quotation to invoice');
      throw error;
    }
  }

  /**
   * Get quotation by ID
   */
  async getQuotation(quotationId: string) {
    try {
      const quotation = await prisma.quotation.findUnique({
        where: { id: quotationId },
        include: {
          items: true,
          lead: true,
          deal: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          invoice: true,
        },
      });

      return quotation;
    } catch (error) {
      logger.error({ error, quotationId }, 'Failed to get quotation');
      throw error;
    }
  }

  /**
   * List quotations with filters
   */
  async listQuotations(filters: {
    userId?: string;
    companyId?: string;
    leadId?: string;
    dealId?: string;
    status?: QuotationStatus;
    page?: number;
    limit?: number;
  }) {
    try {
      const page = filters.page || 1;
      const limit = filters.limit || 20;
      const skip = (page - 1) * limit;

      const where: any = {};
      if (filters.companyId) {
        Object.assign(where, {
          OR: [
            { lead: { companyId: filters.companyId } },
            { user: { primaryCompanyId: filters.companyId } },
            { user: { userCompanies: { some: { companyId: filters.companyId } } } },
          ],
        });
      } else if (filters.userId) {
        where.userId = filters.userId;
      }
      if (filters.leadId) where.leadId = filters.leadId;
      if (filters.dealId) where.dealId = filters.dealId;
      if (filters.status) where.status = filters.status;

      const [quotations, total] = await Promise.all([
        prisma.quotation.findMany({
          where,
          include: {
            items: true,
            lead: {
              select: {
                id: true,
                companyName: true,
              },
            },
            deal: {
              select: {
                id: true,
                title: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
          skip,
          take: limit,
        }),
        prisma.quotation.count({ where }),
      ]);

      return {
        quotations,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, filters }, 'Failed to list quotations');
      throw error;
    }
  }

  /**
   * Delete quotation
   */
  async deleteQuotation(quotationId: string) {
    try {
      const quotation = await prisma.quotation.findUnique({
        where: { id: quotationId },
      });

      if (!quotation) {
        throw ApiErrors.notFound('Quotation');
      }

      if (quotation.status !== 'DRAFT') {
        throw ApiErrors.badRequest('Only draft quotations can be deleted');
      }

      await prisma.quotation.delete({
        where: { id: quotationId },
      });

      logger.info({ quotationId }, 'Quotation deleted');

      return true;
    } catch (error) {
      logger.error({ error, quotationId }, 'Failed to delete quotation');
      throw error;
    }
  }
}

export const quotationService = new QuotationService();
