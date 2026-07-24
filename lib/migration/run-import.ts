import { autoMapColumns, requiredMappingGaps } from './auto-map';
import { getFieldsForObject } from './field-catalog';
import { importCustomers } from './importers/customers';
import { importLeads } from './importers/leads';
import { importTickets } from './importers/tickets';
import { parseCsvText } from './parse-csv';
import type {
  ColumnMapping,
  ExecuteResult,
  ImportOptions,
  MigrationObject,
  PreviewResult,
  RunImportContext,
} from './types';

export function buildPreview(
  object: MigrationObject,
  csvText: string
): PreviewResult {
  const { headers, rows } = parseCsvText(csvText);
  const autoMap = autoMapColumns(object, headers);
  const fields = getFieldsForObject(object);
  return {
    object,
    headers,
    sampleRows: rows.slice(0, 10),
    totalRows: rows.length,
    autoMap,
    fields,
    requiredGaps: requiredMappingGaps(object, autoMap),
  };
}

export async function runImport(params: {
  object: MigrationObject;
  csvText: string;
  mapping?: ColumnMapping | null;
  ctx: RunImportContext;
  options?: ImportOptions;
}): Promise<ExecuteResult> {
  const { object, csvText, ctx, options } = params;
  const { headers, rows } = parseCsvText(csvText);
  const mapping = params.mapping ?? autoMapColumns(object, headers);

  const gaps = requiredMappingGaps(object, mapping);
  if (gaps.length) {
    throw new Error(`Missing required column mapping: ${gaps.join(', ')}`);
  }

  switch (object) {
    case 'leads':
      return importLeads(rows, mapping, ctx);
    case 'customers':
      return importCustomers(rows, mapping, ctx);
    case 'tickets':
      return importTickets(rows, mapping, ctx, options);
  }
}

export {
  getFieldsForObject,
  isMigrationObject,
  templateCsvForObject,
} from './field-catalog';
export { autoMapColumns, requiredMappingGaps } from './auto-map';
export type {
  ColumnMapping,
  ExecuteResult,
  ImportOptions,
  MigrationObject,
  PreviewResult,
  ImportSummary,
} from './types';
