import type { FieldDef, MigrationObject } from './types';

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

export function getFieldsForObject(object: MigrationObject): FieldDef[] {
  switch (object) {
    case 'leads':
      return LEAD_FIELDS;
    case 'customers':
      return CUSTOMER_FIELDS;
    case 'tickets':
      return TICKET_FIELDS;
  }
}

export function isMigrationObject(value: unknown): value is MigrationObject {
  return value === 'leads' || value === 'customers' || value === 'tickets';
}

export function templateCsvForObject(object: MigrationObject): string {
  const fields = getFieldsForObject(object);
  const headers = fields.map((f) => f.key);
  const sample =
    object === 'leads'
      ? [
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
        ]
      : object === 'customers'
        ? [
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
          ]
        : [
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
          ];
  const escape = (v: string) =>
    v.includes(',') || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v;
  return `${headers.join(',')}\n${sample.map(escape).join(',')}\n`;
}
