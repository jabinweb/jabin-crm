export type MigrationObject = 'leads' | 'customers' | 'tickets';

export type CsvRow = Record<string, string>;

export type FieldDef = {
  key: string;
  label: string;
  required?: boolean;
  /** Normalized header aliases that auto-map to this field */
  aliases: string[];
};

export type ColumnMapping = Record<string, string | null>;

export type ImportOptions = {
  /** For tickets: create a stub customer when email/org not found */
  createMissingCustomers?: boolean;
};

export type MappedRow = {
  rowNumber: number;
  values: Record<string, string | undefined>;
};

export type RowError = {
  row: number;
  message: string;
};

export type ImportSummary = {
  totalRows: number;
  imported: number;
  skippedDuplicates: number;
  skippedMissingRequired: number;
  skippedUnresolved: number;
  failed: number;
  /** Legacy alias used by leads toolbar toast */
  skippedMissingCompany?: number;
};

export type ExecuteResult = {
  success: boolean;
  object: MigrationObject;
  summary: ImportSummary;
  createdIds: string[];
  errors: RowError[];
};

export type PreviewResult = {
  object: MigrationObject;
  headers: string[];
  sampleRows: CsvRow[];
  totalRows: number;
  autoMap: ColumnMapping;
  fields: FieldDef[];
  requiredGaps: string[];
};

export type RunImportContext = {
  companyId: string;
  userId: string;
  employeeId?: string;
};
