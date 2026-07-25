import { prisma } from '@/lib/prisma';
import { customerService } from '@/lib/crm/customer-service';
import { productService } from '@/lib/crm/product-service';
import { dealService } from '@/lib/crm/deal-service';
import { createDemoUnit } from '@/lib/crm/demo-equipment';
import {
  findCustomerIdByEmail,
  findLeadIdByEmail,
  findLocationIdByName,
  findOrCreateDepartmentId,
  findProductIdByNameOrSku,
  parseBool,
  parseDate,
} from '../dedupe';
import { cell, normalizeEmail, normalizeTags } from '../parse-csv';
import type {
  ColumnMapping,
  CsvRow,
  ExecuteResult,
  ImportSummary,
  MigrationObject,
  RunImportContext,
  RowError,
} from '../types';

function emptySummary(totalRows: number): ImportSummary {
  return {
    totalRows,
    imported: 0,
    skippedDuplicates: 0,
    skippedMissingRequired: 0,
    skippedUnresolved: 0,
    failed: 0,
  };
}

function finish(
  object: MigrationObject,
  summary: ImportSummary,
  createdIds: string[],
  errors: RowError[]
): ExecuteResult {
  summary.failed = errors.length;
  return { success: true, object, summary, createdIds, errors };
}

export async function importContacts(
  rows: CsvRow[],
  mapping: ColumnMapping,
  ctx: RunImportContext
): Promise<ExecuteResult> {
  const errors: RowError[] = [];
  const createdIds: string[] = [];
  const summary = emptySummary(rows.length);

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i + 2;
    const customerEmail = normalizeEmail(cell(row, mapping.customerEmail));
    const name = cell(row, mapping.name);
    if (!customerEmail || !name) {
      summary.skippedMissingRequired += 1;
      continue;
    }
    const customerId = await findCustomerIdByEmail(ctx.companyId, customerEmail);
    if (!customerId) {
      summary.skippedUnresolved += 1;
      continue;
    }
    try {
      const deptName = cell(row, mapping.departmentName);
      const departmentId = deptName
        ? await findOrCreateDepartmentId(customerId, deptName)
        : null;
      const contact = await customerService.addContact(customerId, {
        name,
        role: cell(row, mapping.role) || undefined,
        specialty: cell(row, mapping.specialty) || undefined,
        email: normalizeEmail(cell(row, mapping.email)) || undefined,
        phone: cell(row, mapping.phone) || undefined,
        departmentId,
        isPrimary: parseBool(cell(row, mapping.isPrimary)),
      });
      createdIds.push(contact.id);
      summary.imported += 1;
    } catch (error) {
      errors.push({
        row: rowNumber,
        message: error instanceof Error ? error.message : 'Failed',
      });
    }
  }
  return finish('contacts', summary, createdIds, errors);
}

export async function importDepartments(
  rows: CsvRow[],
  mapping: ColumnMapping,
  ctx: RunImportContext
): Promise<ExecuteResult> {
  const errors: RowError[] = [];
  const createdIds: string[] = [];
  const summary = emptySummary(rows.length);

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i + 2;
    const customerEmail = normalizeEmail(cell(row, mapping.customerEmail));
    const name = cell(row, mapping.name);
    if (!customerEmail || !name) {
      summary.skippedMissingRequired += 1;
      continue;
    }
    const customerId = await findCustomerIdByEmail(ctx.companyId, customerEmail);
    if (!customerId) {
      summary.skippedUnresolved += 1;
      continue;
    }
    try {
      const existing = await prisma.customerDepartment.findFirst({
        where: {
          customerId,
          name: { equals: name, mode: 'insensitive' },
        },
        select: { id: true },
      });
      if (existing) {
        summary.skippedDuplicates += 1;
        continue;
      }
      const dept = await customerService.createDepartment(customerId, {
        name,
        notes: cell(row, mapping.notes) || undefined,
      });
      createdIds.push(dept.id);
      summary.imported += 1;
    } catch (error) {
      errors.push({
        row: rowNumber,
        message: error instanceof Error ? error.message : 'Failed',
      });
    }
  }
  return finish('departments', summary, createdIds, errors);
}

export async function importVisits(
  rows: CsvRow[],
  mapping: ColumnMapping,
  ctx: RunImportContext
): Promise<ExecuteResult> {
  const errors: RowError[] = [];
  const createdIds: string[] = [];
  const summary = emptySummary(rows.length);

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i + 2;
    const customerEmail = normalizeEmail(cell(row, mapping.customerEmail));
    const scheduledAt = parseDate(cell(row, mapping.scheduledAt));
    if (!customerEmail || !scheduledAt) {
      summary.skippedMissingRequired += 1;
      continue;
    }
    const customerId = await findCustomerIdByEmail(ctx.companyId, customerEmail);
    if (!customerId) {
      summary.skippedUnresolved += 1;
      continue;
    }
    try {
      const deptName = cell(row, mapping.departmentName);
      const departmentId = deptName
        ? await findOrCreateDepartmentId(customerId, deptName)
        : null;
      const recurrenceRaw = (cell(row, mapping.recurrenceRule) || 'NONE').toUpperCase();
      const recurrenceRule =
        recurrenceRaw === 'WEEKLY' || recurrenceRaw === 'MONTHLY'
          ? recurrenceRaw
          : 'NONE';
      const statusRaw = (cell(row, mapping.status) || 'SCHEDULED').toUpperCase();
      const status =
        statusRaw === 'COMPLETED' || statusRaw === 'CANCELLED' || statusRaw === 'NO_SHOW'
          ? statusRaw
          : 'SCHEDULED';
      const visit = await customerService.createVisit(
        customerId,
        ctx.companyId,
        {
          scheduledAt,
          notes: cell(row, mapping.notes) || undefined,
          departmentId,
          recurrenceRule,
          status: status as 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW',
        },
        ctx.userId
      );
      createdIds.push(visit.id);
      summary.imported += 1;
    } catch (error) {
      errors.push({
        row: rowNumber,
        message: error instanceof Error ? error.message : 'Failed',
      });
    }
  }
  return finish('visits', summary, createdIds, errors);
}

export async function importProducts(
  rows: CsvRow[],
  mapping: ColumnMapping,
  ctx: RunImportContext
): Promise<ExecuteResult> {
  const errors: RowError[] = [];
  const createdIds: string[] = [];
  const summary = emptySummary(rows.length);
  const seenSkus = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i + 2;
    const name = cell(row, mapping.name);
    if (!name) {
      summary.skippedMissingRequired += 1;
      continue;
    }
    const sku = cell(row, mapping.sku)?.trim() || null;
    if (sku) {
      if (seenSkus.has(sku.toLowerCase())) {
        summary.skippedDuplicates += 1;
        continue;
      }
      const existing = await prisma.product.findFirst({
        where: { companyId: ctx.companyId, sku: { equals: sku, mode: 'insensitive' } },
        select: { id: true },
      });
      if (existing) {
        summary.skippedDuplicates += 1;
        continue;
      }
    }
    try {
      const typeRaw = (cell(row, mapping.type) || 'EQUIPMENT').toUpperCase();
      const type = typeRaw === 'CONSUMABLE' ? 'CONSUMABLE' : 'EQUIPMENT';
      const price = Number(cell(row, mapping.price));
      const quantity = Number(cell(row, mapping.quantity));
      const product = await prisma.product.create({
        data: {
          name,
          companyId: ctx.companyId,
          sku,
          category: cell(row, mapping.category) || null,
          type,
          manufacturer: cell(row, mapping.manufacturer) || null,
          modelNumber: cell(row, mapping.modelNumber) || null,
          description: cell(row, mapping.description) || null,
          price: Number.isFinite(price) ? price : null,
          quantity: Number.isFinite(quantity) ? Math.max(0, Math.floor(quantity)) : 0,
        },
      });
      createdIds.push(product.id);
      summary.imported += 1;
      if (sku) seenSkus.add(sku.toLowerCase());
    } catch (error) {
      errors.push({
        row: rowNumber,
        message: error instanceof Error ? error.message : 'Failed',
      });
    }
  }
  return finish('products', summary, createdIds, errors);
}

export async function importEquipment(
  rows: CsvRow[],
  mapping: ColumnMapping,
  ctx: RunImportContext
): Promise<ExecuteResult> {
  const errors: RowError[] = [];
  const createdIds: string[] = [];
  const summary = emptySummary(rows.length);

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i + 2;
    const customerEmail = normalizeEmail(cell(row, mapping.customerEmail));
    const productName = cell(row, mapping.productName);
    if (!customerEmail || !productName) {
      summary.skippedMissingRequired += 1;
      continue;
    }
    const customerId = await findCustomerIdByEmail(ctx.companyId, customerEmail);
    const productId = await findProductIdByNameOrSku(ctx.companyId, productName);
    if (!customerId || !productId) {
      summary.skippedUnresolved += 1;
      continue;
    }
    try {
      const serial = cell(row, mapping.serialNumber) || undefined;
      if (serial) {
        const dup = await prisma.equipmentInstallation.findFirst({
          where: { customerId, serialNumber: serial },
          select: { id: true },
        });
        if (dup) {
          summary.skippedDuplicates += 1;
          continue;
        }
      }
      const statusRaw = (cell(row, mapping.status) || 'ACTIVE').toUpperCase();
      const status =
        statusRaw === 'UNDER_MAINTENANCE' || statusRaw === 'DECOMMISSIONED'
          ? statusRaw
          : 'ACTIVE';
      const installation = await productService.installEquipment({
        productId,
        customerId,
        serialNumber: serial,
        installationDate: parseDate(cell(row, mapping.installationDate)) || undefined,
        warrantyExpiry: parseDate(cell(row, mapping.warrantyExpiry)) || undefined,
        status: status as 'ACTIVE' | 'UNDER_MAINTENANCE' | 'DECOMMISSIONED',
        notes: cell(row, mapping.notes) || undefined,
      });
      createdIds.push(installation.id);
      summary.imported += 1;
    } catch (error) {
      errors.push({
        row: rowNumber,
        message: error instanceof Error ? error.message : 'Failed',
      });
    }
  }
  return finish('equipment', summary, createdIds, errors);
}

export async function importDemoEquipment(
  rows: CsvRow[],
  mapping: ColumnMapping,
  ctx: RunImportContext
): Promise<ExecuteResult> {
  const errors: RowError[] = [];
  const createdIds: string[] = [];
  const summary = emptySummary(rows.length);

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i + 2;
    const name = cell(row, mapping.name);
    if (!name) {
      summary.skippedMissingRequired += 1;
      continue;
    }
    try {
      const serial = cell(row, mapping.serialNumber)?.trim();
      if (serial) {
        const dup = await prisma.demoEquipmentUnit.findFirst({
          where: { companyId: ctx.companyId, serialNumber: serial },
          select: { id: true },
        });
        if (dup) {
          summary.skippedDuplicates += 1;
          continue;
        }
      }
      const kindRaw = (cell(row, mapping.kind) || 'DEMO_MACHINE').toUpperCase();
      const kind =
        kindRaw === 'EQUIPMENT' || kindRaw === 'INSTRUMENT'
          ? kindRaw
          : 'DEMO_MACHINE';
      const statusRaw = (cell(row, mapping.status) || 'IN_STOCK').toUpperCase();
      const allowed = [
        'IN_STOCK',
        'ON_DEMO',
        'AT_CUSTOMER',
        'IN_TRANSIT',
        'MAINTENANCE',
        'RETIRED',
      ] as const;
      const status = (allowed as readonly string[]).includes(statusRaw)
        ? (statusRaw as (typeof allowed)[number])
        : 'IN_STOCK';
      const productName = cell(row, mapping.productName);
      const productId = productName
        ? await findProductIdByNameOrSku(ctx.companyId, productName)
        : null;
      const locationName = cell(row, mapping.locationName);
      const currentLocationId = locationName
        ? await findLocationIdByName(ctx.companyId, locationName)
        : null;
      const unit = await createDemoUnit(ctx.companyId, {
        name,
        kind,
        serialNumber: serial || null,
        assetTag: cell(row, mapping.assetTag) || null,
        productId,
        currentLocationId,
        status,
        notes: cell(row, mapping.notes) || null,
      });
      createdIds.push(unit.id);
      summary.imported += 1;
    } catch (error) {
      errors.push({
        row: rowNumber,
        message: error instanceof Error ? error.message : 'Failed',
      });
    }
  }
  return finish('demo-equipment', summary, createdIds, errors);
}

export async function importSuppliers(
  rows: CsvRow[],
  mapping: ColumnMapping,
  ctx: RunImportContext
): Promise<ExecuteResult> {
  const errors: RowError[] = [];
  const createdIds: string[] = [];
  const summary = emptySummary(rows.length);
  const seen = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i + 2;
    const name = cell(row, mapping.name);
    const email = normalizeEmail(cell(row, mapping.email));
    const phone = cell(row, mapping.phone);
    const address = cell(row, mapping.address);
    if (!name || !email || !phone || !address) {
      summary.skippedMissingRequired += 1;
      continue;
    }
    if (seen.has(email)) {
      summary.skippedDuplicates += 1;
      continue;
    }
    const existing = await prisma.supplier.findFirst({
      where: { companyId: ctx.companyId, email: { equals: email, mode: 'insensitive' } },
      select: { id: true },
    });
    if (existing) {
      summary.skippedDuplicates += 1;
      continue;
    }
    try {
      const rating = Number(cell(row, mapping.rating));
      const supplier = await prisma.supplier.create({
        data: {
          name,
          email,
          phone,
          address,
          rating: Number.isFinite(rating) ? Math.min(5, Math.max(0, rating)) : null,
          companyId: ctx.companyId,
        },
      });
      createdIds.push(supplier.id);
      summary.imported += 1;
      seen.add(email);
    } catch (error) {
      errors.push({
        row: rowNumber,
        message: error instanceof Error ? error.message : 'Failed',
      });
    }
  }
  return finish('suppliers', summary, createdIds, errors);
}

export async function importLocations(
  rows: CsvRow[],
  mapping: ColumnMapping,
  ctx: RunImportContext
): Promise<ExecuteResult> {
  const errors: RowError[] = [];
  const createdIds: string[] = [];
  const summary = emptySummary(rows.length);

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i + 2;
    const name = cell(row, mapping.name);
    const typeRaw = cell(row, mapping.type);
    const address = cell(row, mapping.address);
    if (!name || !typeRaw || !address) {
      summary.skippedMissingRequired += 1;
      continue;
    }
    const existing = await findLocationIdByName(ctx.companyId, name);
    if (existing) {
      summary.skippedDuplicates += 1;
      continue;
    }
    try {
      const type = ['WAREHOUSE', 'STORE', 'VAN'].includes(typeRaw.toUpperCase())
        ? typeRaw.toUpperCase()
        : typeRaw;
      const prefix = ctx.companyId.slice(0, 8);
      const rawCode = cell(row, mapping.code)?.trim();
      const code =
        rawCode ||
        `${prefix}-${type.slice(0, 4).toUpperCase()}-${Math.random()
          .toString(36)
          .slice(2, 6)
          .toUpperCase()}`;
      const location = await prisma.location.create({
        data: {
          name,
          type,
          address,
          code,
          companyId: ctx.companyId,
        },
      });
      createdIds.push(location.id);
      summary.imported += 1;
    } catch (error) {
      errors.push({
        row: rowNumber,
        message: error instanceof Error ? error.message : 'Failed',
      });
    }
  }
  return finish('locations', summary, createdIds, errors);
}

export async function importDeals(
  rows: CsvRow[],
  mapping: ColumnMapping,
  ctx: RunImportContext
): Promise<ExecuteResult> {
  const errors: RowError[] = [];
  const createdIds: string[] = [];
  const summary = emptySummary(rows.length);

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i + 2;
    const title = cell(row, mapping.title);
    const leadEmail = normalizeEmail(cell(row, mapping.leadEmail));
    if (!title || !leadEmail) {
      summary.skippedMissingRequired += 1;
      continue;
    }
    const leadId = await findLeadIdByEmail(ctx.companyId, leadEmail);
    if (!leadId) {
      summary.skippedUnresolved += 1;
      continue;
    }
    try {
      const value = Number(cell(row, mapping.value));
      const probability = Number(cell(row, mapping.probability));
      const stageRaw = (cell(row, mapping.stage) || 'PROSPECTING').toUpperCase();
      const stages = [
        'PROSPECTING',
        'QUALIFICATION',
        'PROPOSAL',
        'NEGOTIATION',
        'CLOSED_WON',
        'CLOSED_LOST',
      ] as const;
      const stage = (stages as readonly string[]).includes(stageRaw)
        ? (stageRaw as (typeof stages)[number])
        : 'PROSPECTING';
      const deal = await dealService.createDeal(ctx.userId, {
        title,
        leadId,
        value: Number.isFinite(value) ? value : 0,
        stage,
        probability: Number.isFinite(probability) ? probability : undefined,
        expectedCloseDate: parseDate(cell(row, mapping.expectedCloseDate)) || undefined,
        notes: cell(row, mapping.notes) || undefined,
      });
      createdIds.push(deal.id);
      summary.imported += 1;
    } catch (error) {
      errors.push({
        row: rowNumber,
        message: error instanceof Error ? error.message : 'Failed',
      });
    }
  }
  return finish('deals', summary, createdIds, errors);
}

export async function importCannedResponses(
  rows: CsvRow[],
  mapping: ColumnMapping,
  ctx: RunImportContext
): Promise<ExecuteResult> {
  const errors: RowError[] = [];
  const createdIds: string[] = [];
  const summary = emptySummary(rows.length);

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i + 2;
    const title = cell(row, mapping.title);
    const body = cell(row, mapping.body);
    if (!title || !body) {
      summary.skippedMissingRequired += 1;
      continue;
    }
    try {
      const existing = await prisma.supportCannedResponse.findFirst({
        where: {
          companyId: ctx.companyId,
          title: { equals: title, mode: 'insensitive' },
        },
        select: { id: true },
      });
      if (existing) {
        summary.skippedDuplicates += 1;
        continue;
      }
      const item = await prisma.supportCannedResponse.create({
        data: {
          title,
          body,
          category: cell(row, mapping.category) || null,
          companyId: ctx.companyId,
          createdById: ctx.userId,
          isShared: true,
        },
      });
      createdIds.push(item.id);
      summary.imported += 1;
    } catch (error) {
      errors.push({
        row: rowNumber,
        message: error instanceof Error ? error.message : 'Failed',
      });
    }
  }
  return finish('canned-responses', summary, createdIds, errors);
}

export async function importKnowledge(
  rows: CsvRow[],
  mapping: ColumnMapping,
  ctx: RunImportContext
): Promise<ExecuteResult> {
  const errors: RowError[] = [];
  const createdIds: string[] = [];
  const summary = emptySummary(rows.length);

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i + 2;
    const title = cell(row, mapping.title);
    const content = cell(row, mapping.content);
    if (!title || !content) {
      summary.skippedMissingRequired += 1;
      continue;
    }
    try {
      const slug =
        cell(row, mapping.slug)?.trim() ||
        title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '');
      const existing = await prisma.knowledgeArticle.findFirst({
        where: { slug },
        select: { id: true },
      });
      if (existing) {
        summary.skippedDuplicates += 1;
        continue;
      }
      const article = await prisma.knowledgeArticle.create({
        data: {
          title,
          slug,
          content,
          category: cell(row, mapping.category) || null,
          tags: normalizeTags(cell(row, mapping.tags)),
          published: parseBool(cell(row, mapping.published)),
          companyId: ctx.companyId,
        },
      });
      createdIds.push(article.id);
      summary.imported += 1;
    } catch (error) {
      errors.push({
        row: rowNumber,
        message: error instanceof Error ? error.message : 'Failed',
      });
    }
  }
  return finish('knowledge', summary, createdIds, errors);
}
