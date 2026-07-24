import Papa from 'papaparse';
import { MAX_IMPORT_ROWS } from './field-catalog';
import type { CsvRow } from './types';

export function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/\s+/g, '_');
}

export function normalizeEmail(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const email = value.trim().toLowerCase();
  return email.length > 0 ? email : undefined;
}

export function normalizeTags(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(/[;,|]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function parseCsvText(csvText: string): {
  headers: string[];
  rows: CsvRow[];
} {
  const trimmed = csvText.trim();
  if (!trimmed) {
    throw new Error('CSV file is empty');
  }

  const parsed = Papa.parse<CsvRow>(trimmed, {
    header: true,
    skipEmptyLines: true,
    transformHeader: normalizeHeader,
  });

  if (parsed.errors.length > 0) {
    throw new Error(`CSV parsing failed: ${parsed.errors[0]?.message || 'Invalid CSV format'}`);
  }

  if (!parsed.data.length) {
    throw new Error('CSV contains no data rows');
  }

  if (parsed.data.length > MAX_IMPORT_ROWS) {
    throw new Error(`CSV row limit exceeded. Maximum ${MAX_IMPORT_ROWS} rows per import.`);
  }

  const headers =
    parsed.meta.fields?.map((h) => normalizeHeader(String(h))) ??
    Object.keys(parsed.data[0] ?? {});

  return { headers, rows: parsed.data };
}

export function cell(row: CsvRow, header: string | null | undefined): string | undefined {
  if (!header) return undefined;
  const value = row[header];
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
