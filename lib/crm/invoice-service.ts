import { prisma } from '@/lib/prisma';
import logger from '@/lib/logger';
import { Prisma } from '@prisma/client';
import type { Invoice, InvoiceItem, InvoiceStatus } from '@prisma/client';
import { ApiErrors } from '@/lib/api-error-handler';

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Infer the stored GST split type from a saved taxBreakup JSON. */
function gstTypeFromBreakup(breakup: unknown): 'CGST_SGST' | 'IGST' | null {
  if (!breakup || typeof breakup !== 'object') return null;
  const b = breakup as { cgst?: number; sgst?: number; igst?: number };
  if ((b.igst ?? 0) > 0) return 'IGST';
  if ((b.cgst ?? 0) > 0 || (b.sgst ?? 0) > 0) return 'CGST_SGST';
  return null;
}

export interface CreateInvoiceInput {
  userId: string;
  /** Request workspace; used to scope auto-created leads */
  companyId?: string;
  leadId?: string;
  dealId?: string;
  customerId?: string;
  projectId?: string;
  quotationId?: string;
  title: string;
  description?: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  customerAddress?: string;
  currency?: string;
  taxRate?: number;
  discount?: number;
  dueInDays?: number;
  /** Explicit due date (YYYY-MM-DD or ISO); takes precedence over dueInDays */
  dueDate?: string;
  paymentMethod?: string;
  terms?: string;
  notes?: string;
  /** Seller GSTIN */
  gstin?: string | null;
  /** Place of supply (state name or code) */
  placeOfSupply?: string | null;
  /** CGST_SGST (intra) or IGST (inter) */
  gstTaxType?: 'CGST_SGST' | 'IGST' | null;
  // Payment details
  bankName?: string;
  accountName?: string;
  accountNumber?: string;
  routingNumber?: string;
  swiftCode?: string;
  iban?: string;
  paymentInstructions?: string;
  items: Array<{
    name: string;
    description?: string;
    quantity: number;
    unitPrice: number;
    hsnSac?: string | null;
  }>;
}

export function buildGstTaxBreakup(
  taxAmount: number,
  gstTaxType?: 'CGST_SGST' | 'IGST' | null
): { cgst: number; sgst: number; igst: number; taxableHint?: string } | null {
  if (!gstTaxType || taxAmount <= 0) return null;
  const round2 = (n: number) => Math.round(n * 100) / 100;
  if (gstTaxType === 'IGST') {
    return { cgst: 0, sgst: 0, igst: round2(taxAmount) };
  }
  const half = round2(taxAmount / 2);
  return { cgst: half, sgst: round2(taxAmount - half), igst: 0 };
}

export interface RecordPaymentInput {
  amount: number;
  paymentMethod?: string;
  paymentDetails?: string;
  razorpayPaymentId?: string;
}

export class InvoiceService {
  /**
   * Generate a unique invoice number
   */
  private async generateInvoiceNumber(): Promise<string> {
    const prefix = 'INV';
    const year = new Date().getFullYear().toString().slice(-2);
    const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
    
    const lastInvoice = await prisma.invoice.findFirst({
      where: {
        invoiceNumber: {
          startsWith: `${prefix}${year}${month}`,
        },
      },
      // Highest number, not most recent row (rows can be created out of sequence)
      orderBy: {
        invoiceNumber: 'desc',
      },
    });

    let sequence = 1;
    if (lastInvoice) {
      const lastSequence = parseInt(lastInvoice.invoiceNumber.slice(`${prefix}${year}${month}`.length), 10);
      sequence = (Number.isFinite(lastSequence) ? lastSequence : 0) + 1;
    }

    return `${prefix}${year}${month}${sequence.toString().padStart(4, '0')}`;
  }

  /**
   * Calculate invoice totals
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
   * Create a new invoice
   */
  async createInvoice(input: CreateInvoiceInput) {
    try {
      const { subtotal, taxAmount, total } = this.calculateTotals(
        input.items,
        input.taxRate || 0,
        input.discount || 0
      );

      const explicitDue = input.dueDate ? new Date(input.dueDate) : null;
      const dueDate =
        explicitDue && !Number.isNaN(explicitDue.getTime())
          ? explicitDue
          : input.dueInDays
            ? new Date(Date.now() + input.dueInDays * 24 * 60 * 60 * 1000)
            : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // Default 30 days

      // Auto-create customer as lead if they don't exist
      let leadId = input.leadId;
      if (!leadId && input.customerEmail) {
        const existingLead = await prisma.lead.findFirst({
          where: {
            userId: input.userId,
            email: input.customerEmail,
            // Do not attach the invoice to a lead from another workspace
            ...(input.companyId ? { companyId: input.companyId } : {}),
          },
        });

        if (existingLead) {
          leadId = existingLead.id;
        } else {
          // Create new lead from invoice customer data
          const newLead = await prisma.lead.create({
            data: {
              userId: input.userId,
              contactName: input.customerName,
              email: input.customerEmail,
              phone: input.customerPhone || null,
              address: input.customerAddress || null,
              companyName: input.customerName, // Using customer name as company name for now
              status: 'NEW',
              source: 'INVOICE',
              companyId: input.companyId ?? null,
            },
          });
          leadId = newLead.id;
          logger.info({
            leadId: newLead.id,
            customerEmail: input.customerEmail,
          }, 'Auto-created lead from invoice customer data');
        }
      }

      const { resolveBillingCustomerId } = await import('@/lib/api/portal-billing-scope');
      const { resolveDocumentCurrency } = await import('@/lib/currency/resolve-document');
      const customerId = await resolveBillingCustomerId({
        customerId: input.customerId,
        customerEmail: input.customerEmail,
        userId: input.userId,
        companyId: input.companyId,
      });

      const currency = await resolveDocumentCurrency({
        explicit: input.currency,
        customerId,
        customerEmail: input.customerEmail,
        companyId: input.companyId,
        userId: input.userId,
      });

      const taxBreakup = buildGstTaxBreakup(taxAmount, input.gstTaxType);

      // Invoice numbers are globally unique; retry when a concurrent create took ours.
      const createWithNumber = async () => {
        const invoiceNumber = await this.generateInvoiceNumber();
        return prisma.invoice.create({
        data: {
          invoiceNumber,
          userId: input.userId,
          leadId,
          dealId: input.dealId,
          customerId: customerId || null,
          projectId: input.projectId || null,
          quotationId: input.quotationId,
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
          amountPaid: 0,
          amountDue: total,
          dueDate,
          gstin: input.gstin?.trim() || null,
          placeOfSupply: input.placeOfSupply?.trim() || null,
          taxBreakup: taxBreakup ?? undefined,
          paymentMethod: input.paymentMethod,
          paymentDetails: input.bankName || input.accountNumber ? JSON.stringify({
            bankName: input.bankName,
            accountName: input.accountName,
            accountNumber: input.accountNumber,
            routingNumber: input.routingNumber,
            swiftCode: input.swiftCode,
            iban: input.iban,
            paymentInstructions: input.paymentInstructions,
          }) : null,
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
              hsnSac: item.hsnSac?.trim() || null,
            })),
          },
        },
        include: {
          items: true,
          lead: true,
          deal: true,
          quotation: true,
        },
      });
      };

      let invoice!: Awaited<ReturnType<typeof createWithNumber>>;
      for (let attempt = 0; ; attempt++) {
        try {
          invoice = await createWithNumber();
          break;
        } catch (err) {
          const isNumberClash =
            err instanceof Prisma.PrismaClientKnownRequestError &&
            err.code === 'P2002' &&
            JSON.stringify(err.meta ?? {}).includes('invoiceNumber');
          if (!isNumberClash || attempt >= 4) throw err;
        }
      }

      logger.info({
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        userId: input.userId,
      }, 'Invoice created');

      return invoice;
    } catch (error) {
      logger.error({ error, input }, 'Failed to create invoice');
      throw error;
    }
  }

  /**
   * Send invoice to customer
   */
  async sendInvoice(invoiceId: string) {
    try {
      const existing = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        select: { status: true },
      });
      if (!existing) throw ApiErrors.notFound('Invoice');
      if (existing.status === 'CANCELLED' || existing.status === 'REFUNDED') {
        throw ApiErrors.badRequest(`Cannot send a ${existing.status.toLowerCase()} invoice`);
      }

      const invoice = await prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          // Re-sending must not move a paid/partial/overdue invoice back to SENT
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

      logger.info({ invoiceId }, 'Invoice sent');

      // Send email with PDF attachment
      await this.sendInvoiceEmail(invoice);

      return invoice;
    } catch (error) {
      logger.error({ error, invoiceId }, 'Failed to send invoice');
      throw error;
    }
  }

  /**
   * Send invoice email with PDF attachment
   */
  private async sendInvoiceEmail(invoice: any) {
    try {
      const { sendInvoiceEmail } = await import('@/lib/email/invoice-email');
      await sendInvoiceEmail(invoice);
    } catch (error) {
      logger.error({ error, invoiceId: invoice.id }, 'Failed to send invoice email');
      // Don't throw - invoice is already marked as sent
    }
  }

  /**
   * Record a payment for an invoice
   */
  async recordPayment(invoiceId: string, paymentInput: RecordPaymentInput) {
    try {
      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
      });

      if (!invoice) {
        throw ApiErrors.notFound('Invoice');
      }

      if (invoice.status === 'PAID') {
        throw ApiErrors.badRequest('Invoice is already paid');
      }
      if (invoice.status === 'CANCELLED' || invoice.status === 'REFUNDED') {
        throw ApiErrors.badRequest(`Cannot record a payment on a ${invoice.status.toLowerCase()} invoice`);
      }

      const newAmountPaid = round2(invoice.amountPaid + paymentInput.amount);
      const newAmountDue = round2(invoice.total - newAmountPaid);

      let newStatus: InvoiceStatus = invoice.status;
      if (newAmountDue <= 0) {
        newStatus = 'PAID';
      } else if (newAmountPaid > 0) {
        newStatus = 'PARTIAL';
      }

      const paymentNote = [
        paymentInput.paymentMethod ? `Method: ${paymentInput.paymentMethod}` : null,
        paymentInput.paymentDetails ? paymentInput.paymentDetails : null,
        `Amount: ${paymentInput.amount}`,
        new Date().toISOString(),
      ]
        .filter(Boolean)
        .join(' · ');

      // Optimistic concurrency: fail instead of losing a concurrent payment
      const guard = await prisma.invoice.updateMany({
        where: { id: invoiceId, amountPaid: invoice.amountPaid, status: invoice.status },
        data: { amountPaid: newAmountPaid },
      });
      if (guard.count === 0) {
        throw ApiErrors.conflict('Invoice was updated concurrently; please retry');
      }

      const updatedInvoice = await prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          amountPaid: newAmountPaid,
          amountDue: Math.max(0, newAmountDue),
          status: newStatus,
          paidAt: newStatus === 'PAID' ? new Date() : undefined,
          paymentMethod: paymentInput.paymentMethod || invoice.paymentMethod,
          // Keep bank/payment instructions JSON intact; append audit to notes
          notes: invoice.notes
            ? `${invoice.notes}\n[Payment] ${paymentNote}`
            : `[Payment] ${paymentNote}`,
          payments: paymentInput.razorpayPaymentId
            ? {
                connect: { razorpayPaymentId: paymentInput.razorpayPaymentId },
              }
            : undefined,
        },
        include: {
          items: true,
          payments: true,
        },
      });

      logger.info({
        invoiceId,
        amount: paymentInput.amount,
        status: newStatus,
      }, 'Payment recorded');

      return updatedInvoice;
    } catch (error) {
      logger.error({ error, invoiceId, paymentInput }, 'Failed to record payment');
      throw error;
    }
  }

  /**
   * Mark invoice as viewed
   */
  async markAsViewed(invoiceId: string) {
    try {
      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
      });

      if (!invoice || invoice.viewedAt) {
        return invoice;
      }

      const updatedInvoice = await prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          status: invoice.status === 'SENT' ? 'VIEWED' : invoice.status,
          viewedAt: new Date(),
        },
      });

      logger.info({ invoiceId }, 'Invoice marked as viewed');

      return updatedInvoice;
    } catch (error) {
      logger.error({ error, invoiceId }, 'Failed to mark invoice as viewed');
      throw error;
    }
  }

  /**
   * Mark overdue invoices
   */
  async markOverdueInvoices() {
    try {
      const now = new Date();
      const result = await prisma.invoice.updateMany({
        where: {
          dueDate: {
            lt: now,
          },
          status: {
            in: ['SENT', 'VIEWED', 'PARTIAL'],
          },
          amountDue: {
            gt: 0,
          },
        },
        data: {
          status: 'OVERDUE',
        },
      });

      logger.info({ count: result.count }, 'Marked overdue invoices');

      return result;
    } catch (error) {
      logger.error({ error }, 'Failed to mark overdue invoices');
      throw error;
    }
  }

  /**
   * Cancel an invoice
   */
  async cancelInvoice(invoiceId: string, reason?: string) {
    try {
      const invoice = await prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          status: 'CANCELLED',
          notes: reason ? `Cancellation reason: ${reason}` : undefined,
        },
        include: {
          items: true,
        },
      });

      logger.info({ invoiceId }, 'Invoice cancelled');

      return invoice;
    } catch (error) {
      logger.error({ error, invoiceId }, 'Failed to cancel invoice');
      throw error;
    }
  }

  /**
   * Issue refund for an invoice
   */
  async refundInvoice(invoiceId: string, amount?: number, reason?: string) {
    try {
      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
      });

      if (!invoice) {
        throw new Error('Invoice not found');
      }

      if (invoice.status !== 'PAID' && invoice.status !== 'PARTIAL') {
        throw new Error('Only paid or partially paid invoices can be refunded');
      }

      const refundAmount = amount || invoice.amountPaid;
      
      if (refundAmount > invoice.amountPaid) {
        throw new Error('Refund amount cannot exceed paid amount');
      }

      const newAmountPaid = invoice.amountPaid - refundAmount;
      const newAmountDue = invoice.total - newAmountPaid;

      const updatedInvoice = await prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          amountPaid: newAmountPaid,
          amountDue: newAmountDue,
          status: refundAmount === invoice.amountPaid ? 'REFUNDED' : 'PARTIAL',
          notes: reason
            ? `${invoice.notes || ''}\nRefund: ${reason}`
            : invoice.notes,
        },
        include: {
          items: true,
          payments: true,
        },
      });

      logger.info({
        invoiceId,
        refundAmount,
        status: updatedInvoice.status,
      }, 'Invoice refunded');

      return updatedInvoice;
    } catch (error) {
      logger.error({ error, invoiceId, amount }, 'Failed to refund invoice');
      throw error;
    }
  }

  /**
   * Get invoice by ID
   */
  async getInvoice(invoiceId: string) {
    try {
      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: {
          items: true,
          lead: true,
          deal: { select: { id: true, title: true, stage: true } },
          customer: { select: { id: true, organizationName: true } },
          quotation: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              profile: {
                select: {
                  companyName: true,
                  companyEmail: true,
                  companyPhone: true,
                  companyAddress: true,
                },
              },
            },
          },
          payments: true,
        },
      });

      return invoice;
    } catch (error) {
      logger.error({ error, invoiceId }, 'Failed to get invoice');
      throw error;
    }
  }

  /**
   * Get invoice by number
   */
  async getInvoiceByNumber(invoiceNumber: string) {
    try {
      const invoice = await prisma.invoice.findUnique({
        where: { invoiceNumber },
        include: {
          items: true,
          lead: true,
          deal: { select: { id: true, title: true, stage: true } },
          customer: { select: { id: true, organizationName: true } },
          quotation: true,
          payments: true,
        },
      });

      return invoice;
    } catch (error) {
      logger.error({ error, invoiceNumber }, 'Failed to get invoice by number');
      throw error;
    }
  }

  /**
   * List invoices with filters
   */
  async listInvoices(filters: {
    userId?: string;
    companyId?: string;
    customerId?: string;
    customerEmail?: string;
    leadId?: string;
    dealId?: string;
    projectId?: string;
    status?: InvoiceStatus;
    overdue?: boolean;
    page?: number;
    limit?: number;
  }) {
    try {
      const page = filters.page || 1;
      const limit = filters.limit || 20;
      const skip = (page - 1) * limit;

      const where: any = {};
      if (filters.customerId || filters.customerEmail) {
        const or: object[] = [];
        if (filters.customerId) or.push({ customerId: filters.customerId });
        if (filters.customerEmail) {
          or.push({
            customerEmail: { equals: filters.customerEmail, mode: 'insensitive' },
          });
        }
        where.OR = or;
      } else if (filters.companyId) {
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
      if (filters.projectId) where.projectId = filters.projectId;
      if (filters.status) where.status = filters.status;
      if (filters.overdue) {
        where.status = 'OVERDUE';
        where.dueDate = { lt: new Date() };
      }

      const [invoices, total] = await Promise.all([
        prisma.invoice.findMany({
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
            payments: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
          skip,
          take: limit,
        }),
        prisma.invoice.count({ where }),
      ]);

      return {
        invoices,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, filters }, 'Failed to list invoices');
      throw error;
    }
  }

  /**
   * Get invoice statistics
   */
  async getInvoiceStats(userId: string) {
    try {
      const [total, paid, overdue, pending, totalRevenue, paidRevenue, overdueAmount] =
        await Promise.all([
          prisma.invoice.count({ where: { userId } }),
          prisma.invoice.count({ where: { userId, status: 'PAID' } }),
          prisma.invoice.count({ where: { userId, status: 'OVERDUE' } }),
          prisma.invoice.count({
            where: { userId, status: { in: ['SENT', 'VIEWED', 'PARTIAL'] } },
          }),
          prisma.invoice.aggregate({
            where: { userId },
            _sum: { total: true },
          }),
          prisma.invoice.aggregate({
            where: { userId, status: 'PAID' },
            _sum: { total: true },
          }),
          prisma.invoice.aggregate({
            where: { userId, status: 'OVERDUE' },
            _sum: { amountDue: true },
          }),
        ]);

      const { resolveDocumentCurrency } = await import('@/lib/currency/resolve-document');
      const currency = await resolveDocumentCurrency({ userId });

      return {
        total,
        paid,
        overdue,
        pending,
        totalRevenue: totalRevenue._sum.total || 0,
        paidRevenue: paidRevenue._sum.total || 0,
        overdueAmount: overdueAmount._sum.amountDue || 0,
        currency,
      };
    } catch (error) {
      logger.error({ error, userId }, 'Failed to get invoice stats');
      throw error;
    }
  }

  /**
   * Update an existing invoice
   */
  async updateInvoice(
    invoiceId: string,
    userId: string,
    input: Partial<CreateInvoiceInput> & { status?: InvoiceStatus }
  ) {
    try {
      // Verify ownership
      const existingInvoice = await prisma.invoice.findFirst({
        where: { id: invoiceId, userId },
        include: { items: true },
      });

      if (!existingInvoice) {
        throw ApiErrors.notFound('Invoice');
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
        status: input.status,
        ...(input.gstin !== undefined ? { gstin: input.gstin?.trim() || null } : {}),
        ...(input.placeOfSupply !== undefined
          ? { placeOfSupply: input.placeOfSupply?.trim() || null }
          : {}),
      };

      if (input.dueDate) {
        const due = new Date(input.dueDate);
        if (!Number.isNaN(due.getTime())) updateData.dueDate = due;
      }

      // Handle payment details
      if (input.bankName || input.accountName || input.accountNumber || 
          input.routingNumber || input.swiftCode || input.iban || 
          input.paymentInstructions) {
        updateData.paymentDetails = JSON.stringify({
          bankName: input.bankName,
          accountName: input.accountName,
          accountNumber: input.accountNumber,
          routingNumber: input.routingNumber,
          swiftCode: input.swiftCode,
          iban: input.iban,
          paymentInstructions: input.paymentInstructions,
        });
      }

      const hasNewItems = !!(input.items && input.items.length > 0);
      const gstTaxType =
        input.gstTaxType !== undefined
          ? input.gstTaxType
          : gstTypeFromBreakup(existingInvoice.taxBreakup);

      // Recompute totals whenever items, tax rate or discount change (fall back to stored values)
      if (hasNewItems || input.taxRate !== undefined || input.discount !== undefined) {
        const { subtotal, taxAmount, total } = this.calculateTotals(
          hasNewItems ? input.items! : existingInvoice.items,
          input.taxRate ?? existingInvoice.taxRate,
          input.discount ?? existingInvoice.discount
        );

        updateData.subtotal = subtotal;
        updateData.taxAmount = taxAmount;
        updateData.total = total;
        updateData.amountDue = Math.max(0, round2(total - existingInvoice.amountPaid));
        updateData.taxBreakup = buildGstTaxBreakup(taxAmount, gstTaxType) ?? Prisma.DbNull;
      } else if (input.gstTaxType !== undefined) {
        updateData.taxBreakup =
          buildGstTaxBreakup(existingInvoice.taxAmount, input.gstTaxType) ?? Prisma.DbNull;
      }

      if (hasNewItems) {
        // Replace items atomically with the invoice update
        updateData.items = {
          deleteMany: {},
          create: input.items!.map((item) => ({
            name: item.name,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            amount: round2(item.quantity * item.unitPrice),
            hsnSac: item.hsnSac?.trim() || null,
          })),
        };
      }

      const invoice = await prisma.invoice.update({
        where: { id: invoiceId },
        data: updateData,
        include: {
          items: true,
          lead: true,
          deal: true,
          user: {
            include: {
              profile: true,
            },
          },
        },
      });

      logger.info({
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
      }, 'Invoice updated successfully');

      return invoice;
    } catch (error) {
      logger.error({ error, invoiceId, userId }, 'Failed to update invoice');
      throw error;
    }
  }
}

export const invoiceService = new InvoiceService();

