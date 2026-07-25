import {
  ALL_MIGRATION_OBJECTS,
  type FieldDef,
  type MigrationObject,
} from './types';

export const MAX_IMPORT_ROWS = 5000;

export const LEAD_FIELDS: FieldDef[] = [
  {
    key: 'companyName',
    label: 'Company name',
    required: true,
    aliases: ['company_name', 'company', 'account_name', 'name', 'organization'],
  },
  {
    key: 'contactName',
    label: 'Contact name',
    aliases: [
      'contact_name',
      'contact',
      'person_name',
      'contact_person',
      'contactperson',
      'full_name',
    ],
  },
  {
    key: 'email',
    label: 'Email',
    aliases: ['email', 'work_email', 'contact_email', 'email_address'],
  },
  {
    key: 'phone',
    label: 'Phone',
    aliases: ['phone', 'mobile', 'contact_phone', 'phone_number'],
  },
  {
    key: 'website',
    label: 'Website',
    aliases: ['website', 'site', 'url', 'company_website'],
  },
  {
    key: 'address',
    label: 'Address',
    aliases: ['address', 'street_address', 'street'],
  },
  { key: 'city', label: 'City', aliases: ['city'] },
  { key: 'state', label: 'State', aliases: ['state', 'province', 'region'] },
  { key: 'country', label: 'Country', aliases: ['country'] },
  {
    key: 'zipCode',
    label: 'Zip / postal code',
    aliases: ['zip_code', 'zipcode', 'postal_code', 'zip'],
  },
  { key: 'industry', label: 'Industry', aliases: ['industry', 'sector'] },
  {
    key: 'jobTitle',
    label: 'Job title',
    aliases: ['job_title', 'designation', 'title', 'role'],
  },
  {
    key: 'description',
    label: 'Description / notes',
    aliases: ['description', 'notes', 'note', 'comments'],
  },
  { key: 'source', label: 'Source', aliases: ['source', 'lead_source'] },
  {
    key: 'sourceUrl',
    label: 'Source URL',
    aliases: ['source_url', 'source_link'],
  },
  {
    key: 'status',
    label: 'Status',
    aliases: ['status', 'lead_status', 'lifecycle_stage'],
  },
  { key: 'tags', label: 'Tags', aliases: ['tags', 'labels', 'label'] },
];

export const CUSTOMER_FIELDS: FieldDef[] = [
  {
    key: 'organizationName',
    label: 'Organization name',
    required: true,
    aliases: [
      'organization_name',
      'organization',
      'company_name',
      'company',
      'account_name',
      'hospital_name',
      'name',
    ],
  },
  {
    key: 'contactPerson',
    label: 'Contact person',
    required: true,
    aliases: [
      'contact_person',
      'contactperson',
      'contact_name',
      'contact',
      'person_name',
      'primary_contact',
    ],
  },
  {
    key: 'email',
    label: 'Email',
    aliases: ['email', 'work_email', 'contact_email', 'requester_email'],
  },
  {
    key: 'phone',
    label: 'Phone',
    aliases: ['phone', 'mobile', 'contact_phone'],
  },
  {
    key: 'address',
    label: 'Address',
    aliases: ['address', 'street_address'],
  },
  { key: 'city', label: 'City', aliases: ['city'] },
  { key: 'state', label: 'State', aliases: ['state', 'province'] },
  { key: 'industry', label: 'Industry', aliases: ['industry', 'sector'] },
  {
    key: 'accountType',
    label: 'Account type',
    aliases: ['account_type', 'type', 'customer_type'],
  },
  { key: 'notes', label: 'Notes', aliases: ['notes', 'note', 'description'] },
];

export const CONTACT_FIELDS: FieldDef[] = [
  {
    key: 'customerEmail',
    label: 'Customer email (to match account)',
    required: true,
    aliases: ['customer_email', 'account_email', 'org_email', 'company_email'],
  },
  {
    key: 'name',
    label: 'Person name',
    required: true,
    aliases: ['name', 'contact_name', 'person_name', 'full_name'],
  },
  { key: 'role', label: 'Role', aliases: ['role', 'job_title', 'title'] },
  { key: 'specialty', label: 'Specialty', aliases: ['specialty', 'speciality'] },
  {
    key: 'email',
    label: 'Person email',
    aliases: ['email', 'contact_email', 'work_email'],
  },
  {
    key: 'phone',
    label: 'Person phone',
    aliases: ['phone', 'mobile', 'contact_phone'],
  },
  {
    key: 'departmentName',
    label: 'Department name',
    aliases: ['department', 'department_name', 'dept'],
  },
  {
    key: 'isPrimary',
    label: 'Is primary (true/false)',
    aliases: ['is_primary', 'primary'],
  },
];

export const DEPARTMENT_FIELDS: FieldDef[] = [
  {
    key: 'customerEmail',
    label: 'Customer email (to match account)',
    required: true,
    aliases: ['customer_email', 'account_email', 'org_email'],
  },
  {
    key: 'name',
    label: 'Department name',
    required: true,
    aliases: ['name', 'department', 'department_name', 'dept'],
  },
  { key: 'notes', label: 'Notes', aliases: ['notes', 'note', 'description'] },
];

export const VISIT_FIELDS: FieldDef[] = [
  {
    key: 'customerEmail',
    label: 'Customer email',
    required: true,
    aliases: ['customer_email', 'account_email', 'org_email'],
  },
  {
    key: 'scheduledAt',
    label: 'Scheduled at (ISO or YYYY-MM-DD HH:mm)',
    required: true,
    aliases: ['scheduled_at', 'scheduled', 'date', 'visit_date', 'datetime'],
  },
  { key: 'notes', label: 'Notes', aliases: ['notes', 'note', 'purpose'] },
  {
    key: 'departmentName',
    label: 'Department name',
    aliases: ['department', 'department_name', 'dept'],
  },
  {
    key: 'recurrenceRule',
    label: 'Recurrence (NONE/WEEKLY/MONTHLY)',
    aliases: ['recurrence', 'recurrence_rule', 'repeat'],
  },
  {
    key: 'status',
    label: 'Status',
    aliases: ['status', 'visit_status'],
  },
];

export const TICKET_FIELDS: FieldDef[] = [
  {
    key: 'subject',
    label: 'Subject',
    required: true,
    aliases: ['subject', 'ticket_subject', 'title', 'ticket_title'],
  },
  {
    key: 'description',
    label: 'Description',
    required: true,
    aliases: ['description', 'body', 'message', 'ticket_description', 'details'],
  },
  {
    key: 'email',
    label: 'Customer email',
    required: true,
    aliases: [
      'email',
      'customer_email',
      'requester_email',
      'contact_email',
      'from_email',
    ],
  },
  {
    key: 'organizationName',
    label: 'Organization (for stub customer)',
    aliases: ['organization_name', 'company_name', 'company', 'account_name'],
  },
  {
    key: 'contactPerson',
    label: 'Contact person (for stub customer)',
    aliases: ['contact_person', 'contact_name', 'requester_name', 'name'],
  },
  {
    key: 'priority',
    label: 'Priority',
    aliases: ['priority', 'ticket_priority', 'urgency'],
  },
  {
    key: 'status',
    label: 'Status',
    aliases: ['status', 'ticket_status'],
  },
  {
    key: 'channel',
    label: 'Channel',
    aliases: ['channel', 'source', 'ticket_channel'],
  },
  {
    key: 'ticketType',
    label: 'Ticket type',
    aliases: ['ticket_type', 'type', 'category'],
  },
  { key: 'tags', label: 'Tags', aliases: ['tags', 'labels'] },
];

export const PRODUCT_FIELDS: FieldDef[] = [
  {
    key: 'name',
    label: 'Product name',
    required: true,
    aliases: ['name', 'product_name', 'product', 'item_name'],
  },
  { key: 'sku', label: 'SKU', aliases: ['sku', 'product_sku', 'item_code'] },
  {
    key: 'category',
    label: 'Category',
    aliases: ['category', 'product_category'],
  },
  {
    key: 'type',
    label: 'Type (EQUIPMENT/CONSUMABLE)',
    aliases: ['type', 'product_type'],
  },
  {
    key: 'manufacturer',
    label: 'Manufacturer',
    aliases: ['manufacturer', 'brand', 'make'],
  },
  {
    key: 'modelNumber',
    label: 'Model number',
    aliases: ['model_number', 'model', 'model_no'],
  },
  {
    key: 'description',
    label: 'Description',
    aliases: ['description', 'notes'],
  },
  { key: 'price', label: 'Price', aliases: ['price', 'unit_price'] },
  {
    key: 'quantity',
    label: 'Quantity on hand',
    aliases: ['quantity', 'qty', 'stock'],
  },
];

export const EQUIPMENT_FIELDS: FieldDef[] = [
  {
    key: 'customerEmail',
    label: 'Customer email',
    required: true,
    aliases: ['customer_email', 'account_email', 'org_email'],
  },
  {
    key: 'productName',
    label: 'Product name or SKU',
    required: true,
    aliases: ['product_name', 'product', 'sku', 'product_sku', 'equipment'],
  },
  {
    key: 'serialNumber',
    label: 'Serial number',
    aliases: ['serial_number', 'serial', 'sn', 's_n'],
  },
  {
    key: 'installationDate',
    label: 'Installation date',
    aliases: ['installation_date', 'installed_at', 'install_date'],
  },
  {
    key: 'warrantyExpiry',
    label: 'Warranty expiry',
    aliases: ['warranty_expiry', 'warranty_end', 'warranty'],
  },
  {
    key: 'status',
    label: 'Status',
    aliases: ['status', 'installation_status'],
  },
  { key: 'notes', label: 'Notes', aliases: ['notes', 'note'] },
];

export const DEMO_EQUIPMENT_FIELDS: FieldDef[] = [
  {
    key: 'name',
    label: 'Unit name',
    required: true,
    aliases: ['name', 'unit_name', 'equipment_name'],
  },
  {
    key: 'kind',
    label: 'Kind (DEMO_MACHINE/EQUIPMENT/INSTRUMENT)',
    aliases: ['kind', 'type', 'unit_type'],
  },
  {
    key: 'serialNumber',
    label: 'Serial number',
    aliases: ['serial_number', 'serial', 'sn'],
  },
  {
    key: 'assetTag',
    label: 'Asset tag',
    aliases: ['asset_tag', 'tag', 'asset'],
  },
  {
    key: 'productName',
    label: 'Catalog product name/SKU',
    aliases: ['product_name', 'product', 'sku'],
  },
  {
    key: 'locationName',
    label: 'Location name',
    aliases: ['location', 'location_name', 'warehouse'],
  },
  {
    key: 'status',
    label: 'Status',
    aliases: ['status', 'unit_status'],
  },
  { key: 'notes', label: 'Notes', aliases: ['notes', 'note'] },
];

export const SUPPLIER_FIELDS: FieldDef[] = [
  {
    key: 'name',
    label: 'Supplier name',
    required: true,
    aliases: ['name', 'supplier_name', 'vendor', 'vendor_name'],
  },
  {
    key: 'email',
    label: 'Email',
    required: true,
    aliases: ['email', 'supplier_email', 'vendor_email'],
  },
  {
    key: 'phone',
    label: 'Phone',
    required: true,
    aliases: ['phone', 'mobile', 'supplier_phone'],
  },
  {
    key: 'address',
    label: 'Address',
    required: true,
    aliases: ['address', 'supplier_address'],
  },
  { key: 'rating', label: 'Rating (0-5)', aliases: ['rating', 'score'] },
];

export const LOCATION_FIELDS: FieldDef[] = [
  {
    key: 'name',
    label: 'Location name',
    required: true,
    aliases: ['name', 'location_name', 'warehouse', 'store'],
  },
  {
    key: 'type',
    label: 'Type (WAREHOUSE/STORE/VAN)',
    required: true,
    aliases: ['type', 'location_type'],
  },
  {
    key: 'address',
    label: 'Address',
    required: true,
    aliases: ['address', 'location_address'],
  },
  { key: 'code', label: 'Code (optional)', aliases: ['code', 'location_code'] },
];

export const DEAL_FIELDS: FieldDef[] = [
  {
    key: 'title',
    label: 'Deal title',
    required: true,
    aliases: ['title', 'deal_title', 'name', 'opportunity'],
  },
  {
    key: 'leadEmail',
    label: 'Lead email (to match lead)',
    required: true,
    aliases: ['lead_email', 'email', 'contact_email'],
  },
  { key: 'value', label: 'Value', aliases: ['value', 'amount', 'deal_value'] },
  {
    key: 'stage',
    label: 'Stage',
    aliases: ['stage', 'deal_stage', 'pipeline_stage'],
  },
  {
    key: 'probability',
    label: 'Probability %',
    aliases: ['probability', 'win_probability'],
  },
  {
    key: 'expectedCloseDate',
    label: 'Expected close date',
    aliases: ['expected_close_date', 'close_date', 'closing_date'],
  },
  { key: 'notes', label: 'Notes', aliases: ['notes', 'description'] },
];

export const CANNED_FIELDS: FieldDef[] = [
  {
    key: 'title',
    label: 'Title',
    required: true,
    aliases: ['title', 'name', 'template_title'],
  },
  {
    key: 'body',
    label: 'Body',
    required: true,
    aliases: ['body', 'content', 'message', 'template_body'],
  },
  {
    key: 'category',
    label: 'Category',
    aliases: ['category', 'folder', 'group'],
  },
];

export const KNOWLEDGE_FIELDS: FieldDef[] = [
  {
    key: 'title',
    label: 'Title',
    required: true,
    aliases: ['title', 'article_title', 'name'],
  },
  {
    key: 'content',
    label: 'Content',
    required: true,
    aliases: ['content', 'body', 'article', 'html'],
  },
  { key: 'slug', label: 'Slug', aliases: ['slug', 'url_slug', 'permalink'] },
  {
    key: 'category',
    label: 'Category',
    aliases: ['category', 'section'],
  },
  { key: 'tags', label: 'Tags', aliases: ['tags', 'labels'] },
  {
    key: 'published',
    label: 'Published (true/false)',
    aliases: ['published', 'is_published', 'live'],
  },
];

const FIELD_MAP: Record<MigrationObject, FieldDef[]> = {
  leads: LEAD_FIELDS,
  customers: CUSTOMER_FIELDS,
  contacts: CONTACT_FIELDS,
  departments: DEPARTMENT_FIELDS,
  visits: VISIT_FIELDS,
  tickets: TICKET_FIELDS,
  products: PRODUCT_FIELDS,
  equipment: EQUIPMENT_FIELDS,
  'demo-equipment': DEMO_EQUIPMENT_FIELDS,
  suppliers: SUPPLIER_FIELDS,
  locations: LOCATION_FIELDS,
  deals: DEAL_FIELDS,
  'canned-responses': CANNED_FIELDS,
  knowledge: KNOWLEDGE_FIELDS,
};

const SAMPLE_ROWS: Record<MigrationObject, string[]> = {
  leads: [
    'Acme Corp',
    'John Smith',
    'john@acme.com',
    '+1-555-0100',
    'https://acme.com',
    '123 Main St',
    'Austin',
    'TX',
    'US',
    '78701',
    'Technology',
    'CEO',
    'Imported lead',
    'CSV Import',
    '',
    'NEW',
    'import;hubspot',
  ],
  customers: [
    'Acme Corp',
    'John Smith',
    'john@acme.com',
    '+1-555-0100',
    '123 Main St',
    'Austin',
    'TX',
    'Technology',
    'Hospital',
    'Migrated from Freshdesk',
  ],
  contacts: [
    'john@acme.com',
    'Jane Doe',
    'Biomed Engineer',
    'Radiology',
    'jane@acme.com',
    '+1-555-0101',
    'ICU',
    'false',
  ],
  departments: ['john@acme.com', 'ICU', 'Critical care wing'],
  visits: [
    'john@acme.com',
    '2026-08-01 10:00',
    'Demo visit',
    'ICU',
    'NONE',
    'SCHEDULED',
  ],
  tickets: [
    'Printer not working',
    'Unable to print from lab PC',
    'john@acme.com',
    'Acme Corp',
    'John Smith',
    'MEDIUM',
    'OPEN',
    'API',
    'service',
    'import;freshdesk',
  ],
  products: [
    'Ventilator X200',
    'VNT-X200',
    'Critical Care',
    'EQUIPMENT',
    'Acme Medical',
    'X200',
    'ICU ventilator',
    '45000',
    '3',
  ],
  equipment: [
    'john@acme.com',
    'Ventilator X200',
    'SN-001234',
    '2024-01-15',
    '2027-01-15',
    'ACTIVE',
    'Installed in OT-2',
  ],
  'demo-equipment': [
    'Ventilator demo #3',
    'DEMO_MACHINE',
    'DEMO-9988',
    'AST-44',
    'Ventilator X200',
    'Main Warehouse',
    'IN_STOCK',
    '',
  ],
  suppliers: [
    'MedSupply Co',
    'orders@medsupply.com',
    '+1-555-0200',
    '88 Industrial Way',
    '4',
  ],
  locations: ['Main Warehouse', 'WAREHOUSE', '100 Depot Rd', 'WH-MAIN'],
  deals: [
    'ICU expansion',
    'john@acme.com',
    '120000',
    'PROSPECTING',
    '40',
    '2026-09-30',
    'Imported opportunity',
  ],
  'canned-responses': [
    'Acknowledge receipt',
    'Thanks for writing — we received your request and will update you soon.',
    'General',
  ],
  knowledge: [
    'How to raise a service ticket',
    'Step 1: Open the portal…',
    'raise-service-ticket',
    'Getting started',
    'portal;tickets',
    'true',
  ],
};

export function getFieldsForObject(object: MigrationObject): FieldDef[] {
  return FIELD_MAP[object];
}

export function isMigrationObject(value: unknown): value is MigrationObject {
  return (
    typeof value === 'string' &&
    (ALL_MIGRATION_OBJECTS as string[]).includes(value)
  );
}

export function templateCsvForObject(object: MigrationObject): string {
  const fields = getFieldsForObject(object);
  const headers = fields.map((f) => f.key);
  const sample = SAMPLE_ROWS[object] || fields.map(() => '');
  const escape = (v: string) =>
    v.includes(',') || v.includes('"') || v.includes('\n')
      ? `"${v.replace(/"/g, '""')}"`
      : v;
  return `${headers.join(',')}\n${sample.map(escape).join(',')}\n`;
}
