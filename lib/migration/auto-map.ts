import { getFieldsForObject } from './field-catalog';
import type { ColumnMapping, FieldDef, MigrationObject } from './types';

/**
 * Suggest CSV header → field mapping using exact key match then aliases.
 * Each CSV header is used at most once (first matching field wins by catalog order).
 */
export function autoMapColumns(
  object: MigrationObject,
  headers: string[]
): ColumnMapping {
  const fields = getFieldsForObject(object);
  const usedHeaders = new Set<string>();
  const mapping: ColumnMapping = {};

  for (const field of fields) {
    const match = findHeaderForField(field, headers, usedHeaders);
    mapping[field.key] = match;
    if (match) usedHeaders.add(match);
  }

  return mapping;
}

function findHeaderForField(
  field: FieldDef,
  headers: string[],
  used: Set<string>
): string | null {
  const candidates = [field.key.toLowerCase(), ...field.aliases];
  for (const candidate of candidates) {
    const hit = headers.find((h) => h === candidate && !used.has(h));
    if (hit) return hit;
  }
  return null;
}

export function requiredMappingGaps(
  object: MigrationObject,
  mapping: ColumnMapping
): string[] {
  return getFieldsForObject(object)
    .filter((f) => f.required && !mapping[f.key])
    .map((f) => f.key);
}
