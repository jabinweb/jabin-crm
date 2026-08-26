// Complete documentation structure for industry-grade docs
export interface DocTopic {
  id: string;
  title: string;
  slug: string;
  description?: string;
  category: string;
  order: number;
  icon?: string;
  sections: DocSection[];
}

export interface DocSection {
  id: string;
  title: string;
  content: DocContent[];
}

export interface DocContent {
  type: 'heading' | 'paragraph' | 'list' | 'code' | 'alert' | 'table' | 'steps' | 'image' | 'divider' | 'grid';
  data: any;
}

export const documentationTopics: DocTopic[] = [
  // GETTING STARTED
  {
    id: 'introduction',
    title: 'Introduction',
    slug: 'introduction',
    description: 'Welcome to Opslane — sales, service, HR, and client portal',
    category: 'Getting Started',
    order: 1,
    sections: [
      {
        id: 'welcome',
        title: 'Welcome',
        content: [
          {
            type: 'paragraph',
            data: 'Opslane is a multi-tenant workspace for sales CRM, support tickets, field service / AMC, invoicing, HR self-service, and a customer portal. Each company (tenant) gets its own slug URL, settings, and users.',
          },
          {
            type: 'heading',
            data: { level: 3, text: 'Who uses what' },
          },
          {
            type: 'table',
            data: {
              headers: ['Role', 'Primary area', 'Typical jobs'],
              rows: [
                ['SUPER_ADMIN', '/admin', 'Platform: companies, plans, subscriptions, tenancy'],
                ['ADMIN', '/{company}/dashboard + /{company}/admin', 'Workspace CRM, HR, payroll, users, settings'],
                ['SALES / TECH / others', '/{company}/dashboard', 'Leads, deals, tickets, field jobs'],
                ['EMPLOYEE (or staff with employee record)', '/{company}/employee', 'Attendance, leave, payslips, tasks, messages'],
                ['CUSTOMER', '/portal', 'Tickets, assets, quotes, invoices, documents'],
              ],
            },
          },
          {
            type: 'list',
            data: {
              items: [
                'Capture and nurture leads; run deals, quotes, and invoices',
                'Support tickets, live chat, SLA, and customer portal',
                'Field service: equipment, warranties, AMC/CMC contracts',
                'People: employees, attendance, leave, payroll',
                'Industry templates change terminology and which modules appear',
              ],
            },
          },
          {
            type: 'alert',
            data: {
              type: 'info',
              title: 'First time here?',
              message: 'Read Roles & access, then Platform admin, Workspace admin, or Employee portal depending on your role.',
            },
          },
        ],
      },
    ],
  },
  {
    id: 'quick-start',
    title: 'Quick Start Guide',
    slug: 'quick-start',
    description: 'Get a company workspace live',
    category: 'Getting Started',
    order: 2,
    sections: [
      {
        id: 'setup',
        title: 'Workspace admin setup',
        content: [
          {
            type: 'steps',
            data: [
              {
                title: 'Sign in',
                description: 'Sign in at /auth/signin. You are routed by role (dashboard, employee portal, platform admin, or customer portal).',
              },
              {
                title: 'Pick industry / workspace',
                description: 'Settings → Company → Business: choose a vertical so features and labels match your business.',
              },
              {
                title: 'Set company currency',
                description: 'Settings → Company → Payment → Company currency. Defaults new deals, quotes, and invoices. Clients can override via billing currency on the customer record.',
              },
              {
                title: 'Configure email (SMTP/IMAP)',
                description: 'Personal CRM / advanced settings: SMTP for outbound campaigns and sequences; IMAP for reply checking when enabled.',
              },
              {
                title: 'Invite staff & approve employees',
                description: 'Workspace Admin → Users for CRM access. People → Approve staff for HR registrations. Linked employees can open /{company}/employee.',
              },
            ],
          },
          {
            type: 'alert',
            data: {
              type: 'success',
              title: 'Ready to Go!',
              message: 'Add a lead or customer, send a quote, and invite a client to the portal when you are ready.',
            },
          },
        ],
      },
      {
        id: 'first-lead',
        title: 'Add Your First Lead',
        content: [
          {
            type: 'paragraph',
            data: 'There are three ways to add leads to your system:',
          },
          {
            type: 'heading',
            data: { level: 4, text: 'Method 1: Manual Entry' },
          },
          {
            type: 'list',
            data: {
              ordered: true,
              items: [
                'Go to Dashboard → Leads',
                'Click "Add Lead" button',
                'Fill in company name, contact person, email, and phone',
                'Set initial status (New, Contacted, Qualified, etc.)',
                'Add tags for categorization (optional)',
                'Click "Create Lead"',
              ],
            },
          },
          {
            type: 'heading',
            data: { level: 4, text: 'Method 2: CSV Import' },
          },
          {
            type: 'list',
            data: {
              ordered: true,
              items: [
                'Prepare CSV with columns: companyName, email, contactName, phone (or use Settings → Data migration for a mapping wizard)',
                'Go to Dashboard → Leads, or Settings → Data migration',
                'Click Import CSV (or follow the migration wizard steps)',
                'Upload your CSV file',
                'Review the import summary (duplicates are skipped)',
              ],
            },
          },
          {
            type: 'code',
            data: {
              language: 'csv',
              title: 'Example CSV Format',
              code: `companyName,email,contactName,phone,industry
Acme Corp,john@acme.com,John Smith,+1-555-0123,Technology
TechStart Inc,sarah@techstart.io,Sarah Johnson,+1-555-0124,SaaS
Global Solutions,mike@global.com,Mike Davis,+1-555-0125,Consulting`,
            },
          },
          {
            type: 'heading',
            data: { level: 4, text: 'Method 3: Web Scraping' },
          },
          {
            type: 'list',
            data: {
              ordered: true,
              items: [
                'Go to Dashboard → New Scraping Job',
                'Enter target website URL',
                'Configure scraping parameters',
                'Run scraping job',
                'Review scraped data',
                'Import selected leads',
              ],
            },
          },
        ],
      },
    ],
  },

  // FEATURES
  {
    id: 'leads',
    title: 'Lead Management',
    slug: 'lead-management',
    description: 'Capture, organize, and qualify your leads',
    category: 'Features',
    order: 3,
    sections: [
      {
        id: 'lead-scoring',
        title: 'Lead Scoring',
        content: [
          {
            type: 'paragraph',
            data: 'Leads are automatically scored on a scale of 0-100 based on multiple factors. This helps you prioritize your outreach efforts.',
          },
          {
            type: 'table',
            data: {
              headers: ['Score Range', 'Classification', 'Recommended Action'],
              rows: [
                ['0-30', '🔴 Cold Lead', 'Add to re-engagement sequence, quarterly check-in'],
                ['31-60', '🟡 Warm Lead', 'Continue nurturing with follow-up sequences'],
                ['61-100', '🟢 Hot Lead', 'Create deal, schedule demo call, prioritize'],
              ],
            },
          },
          {
            type: 'heading',
            data: { level: 4, text: 'Scoring Factors' },
          },
          {
            type: 'list',
            data: {
              items: [
                'Email engagement: Opens (+5), Clicks (+10), Replies (+20)',
                'Profile completeness: Full profile (+10), partial (-5)',
                'Company information: Valid domain (+15), employee count (+10)',
                'Interaction recency: Recent activity (+10), stale leads (-10)',
                'Deal potential: High value industry (+15)',
                'Response rate: Quick responses (+15), no responses (-10)',
              ],
            },
          },
          {
            type: 'alert',
            data: {
              type: 'info',
              title: 'Manual Adjustments',
              message: 'You can manually adjust lead scores based on phone conversations or other offline interactions.',
            },
          },
        ],
      },
      {
        id: 'lead-statuses',
        title: 'Lead Statuses',
        content: [
          {
            type: 'paragraph',
            data: 'Track leads through your sales funnel with customizable statuses:',
          },
          {
            type: 'table',
            data: {
              headers: ['Status', 'Description', 'Typical Duration'],
              rows: [
                ['New', 'Freshly captured lead, not yet contacted', '0-2 days'],
                ['Contacted', 'Initial outreach sent, awaiting response', '2-7 days'],
                ['Qualified', 'Needs confirmed, budget verified, decision maker identified', '7-14 days'],
                ['Proposal Sent', 'Quote or proposal delivered', '7-21 days'],
                ['Negotiation', 'Terms being discussed', '14-30 days'],
                ['Won', 'Successfully converted to customer', '-'],
                ['Lost', 'Opportunity lost, reason documented', '-'],
                ['Nurture', 'Not ready now, follow up later', '30-90 days'],
              ],
            },
          },
        ],
      },
      {
        id: 'lead-actions',
        title: 'Lead Actions',
        content: [
          {
            type: 'paragraph',
            data: 'Available actions for each lead:',
          },
          {
            type: 'grid',
            data: [
              {
                title: 'Send Email',
                description: 'Send one-time email using templates',
                icon: 'Mail',
              },
              {
                title: 'Enroll in Sequence',
                description: 'Add to automated email sequence',
                icon: 'Zap',
              },
              {
                title: 'Create Deal',
                description: 'Move to sales pipeline',
                icon: 'DollarSign',
              },
              {
                title: 'Schedule Event',
                description: 'Book meeting or call',
                icon: 'Calendar',
              },
              {
                title: 'Add Note',
                description: 'Log interaction or observation',
                icon: 'FileText',
              },
              {
                title: 'Assign to Team',
                description: 'Delegate to team member',
                icon: 'Users',
              },
              {
                title: 'Add Tags',
                description: 'Categorize and filter',
                icon: 'Tag',
              },
              {
                title: 'Mark as Duplicate',
                description: 'Merge with existing lead',
                icon: 'Copy',
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'email-campaigns',
    title: 'Email Campaigns',
    slug: 'email-campaigns',
    description: 'Send bulk emails to multiple recipients',
    category: 'Features',
    order: 4,
    sections: [
      {
        id: 'campaign-overview',
        title: 'What are Campaigns?',
        content: [
          {
            type: 'paragraph',
            data: 'Email Campaigns are one-time bulk email sends to a list of recipients. Think of them as newsletters, announcements, or any single email you want to send to many people at once.',
          },
          {
            type: 'alert',
            data: {
              type: 'info',
              title: 'Campaigns vs Sequences',
              message: 'Use Campaigns for one-time announcements. Use Sequences for multi-step automated follow-ups.',
            },
          },
        ],
      },
      {
        id: 'creating-campaign',
        title: 'Creating a Campaign',
        content: [
          {
            type: 'steps',
            data: [
              {
                title: 'Navigate to Campaigns',
                description: 'Go to Dashboard → Campaigns → New Campaign',
              },
              {
                title: 'Name Your Campaign',
                description: 'Choose an internal name (e.g., "Q1 2026 Product Launch")',
              },
              {
                title: 'Craft Your Email',
                description: 'Write subject line and email body. Use templates or create from scratch.',
              },
              {
                title: 'Select Recipients',
                description: 'Choose all leads, filter by status/score/tags, or upload custom list',
              },
              {
                title: 'Schedule or Send',
                description: 'Send immediately or schedule for specific date/time',
              },
            ],
          },
          {
            type: 'code',
            data: {
              language: 'javascript',
              title: 'Campaign API Example',
              code: `// Create a new campaign via API
const response = await fetch('/api/campaigns', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Product Launch 2026',
    subject: 'Introducing Our New Feature',
    emailTemplate: '<html>...</html>',
    recipientFilter: {
      status: ['Qualified', 'Proposal Sent'],
      minScore: 40
    },
    scheduledAt: '2026-02-01T10:00:00Z'
  })
});`,
            },
          },
        ],
      },
      {
        id: 'campaign-metrics',
        title: 'Tracking Performance',
        content: [
          {
            type: 'paragraph',
            data: 'Monitor your campaign performance with real-time metrics:',
          },
          {
            type: 'table',
            data: {
              headers: ['Metric', 'Description', 'Good Benchmark'],
              rows: [
                ['Sent Count', 'Total emails delivered', '95%+ of total recipients'],
                ['Open Rate', 'Percentage who opened email', '15-25% (B2B)'],
                ['Click Rate', 'Percentage who clicked links', '2-5% (B2B)'],
                ['Bounce Rate', 'Failed deliveries', '<5%'],
                ['Unsubscribe Rate', 'Opt-outs', '<0.5%'],
              ],
            },
          },
          {
            type: 'alert',
            data: {
              type: 'warning',
              title: 'Email Deliverability',
              message: 'Keep bounce rate under 5% and maintain good sender reputation to ensure inbox delivery.',
            },
          },
        ],
      },
    ],
  },
  {
    id: 'email-sequences',
    title: 'Email Sequences',
    slug: 'email-sequences',
    description: 'Automated multi-step email campaigns',
    category: 'Features',
    order: 5,
    sections: [
      {
        id: 'sequence-overview',
        title: 'What are Sequences?',
        content: [
          {
            type: 'paragraph',
            data: 'Email Sequences are automated drip campaigns that send multiple emails over time with delays and conditional logic. Perfect for nurturing leads through a journey.',
          },
          {
            type: 'heading',
            data: { level: 4, text: 'How Sequences Work' },
          },
          {
            type: 'list',
            data: {
              ordered: true,
              items: [
                'You create a sequence with 2-5 email steps',
                'Set delays between steps (days/hours)',
                'Add conditions (e.g., "only send if previous email not opened")',
                'Enroll leads into the sequence',
                'System automatically sends emails based on schedule and conditions',
                'Track individual progress through each step',
              ],
            },
          },
        ],
      },
      {
        id: 'sequence-structure',
        title: 'Sequence Structure',
        content: [
          {
            type: 'paragraph',
            data: 'Example: Welcome & Introduction Sequence',
          },
          {
            type: 'table',
            data: {
              headers: ['Step', 'Delay', 'Subject', 'Condition'],
              rows: [
                ['1', '0 days', 'Introduction - {{companyName}}', 'ALWAYS'],
                ['2', '3 days', 'Following up - {{companyName}}', 'NO_REPLY'],
                ['3', '7 days', 'Last follow-up from {{companyName}}', 'NO_REPLY'],
              ],
            },
          },
          {
            type: 'heading',
            data: { level: 4, text: 'Available Conditions' },
          },
          {
            type: 'list',
            data: {
              items: [
                'ALWAYS - Send regardless of previous actions',
                'NO_REPLY - Only send if they haven\'t replied',
                'NO_OPEN - Only send if they haven\'t opened previous email',
                'CLICKED - Only send if they clicked a link',
                'REPLIED - Only send if they replied',
              ],
            },
          },
        ],
      },
      {
        id: 'default-sequences',
        title: 'Pre-Built Sequences',
        content: [
          {
            type: 'paragraph',
            data: 'The platform includes 5 ready-to-use sequences:',
          },
          {
            type: 'grid',
            data: [
              {
                title: 'Welcome & Introduction',
                description: '3-step sequence for new lead onboarding',
                icon: 'HandWave',
              },
              {
                title: 'Product Demo Follow-up',
                description: '3-step post-demo nurture sequence',
                icon: 'Video',
              },
              {
                title: 'Re-engagement Campaign',
                description: '2-step sequence to revive cold leads',
                icon: 'RefreshCw',
              },
              {
                title: 'Event Follow-up',
                description: '2-step post-event communication',
                icon: 'Calendar',
              },
              {
                title: 'Trial User Nurture',
                description: '3-step trial-to-paid conversion',
                icon: 'Award',
              },
            ],
          },
        ],
      },
      {
        id: 'enrolling-leads',
        title: 'Enrolling Leads',
        content: [
          {
            type: 'steps',
            data: [
              {
                title: 'Select Leads',
                description: 'From Leads page, check boxes next to leads you want to enroll',
              },
              {
                title: 'Click "Enroll in Sequence"',
                description: 'Button appears in bulk actions toolbar',
              },
              {
                title: 'Choose Sequence',
                description: 'Select from dropdown of active sequences',
              },
              {
                title: 'Confirm Enrollment',
                description: 'Review count and click "Enroll"',
              },
            ],
          },
          {
            type: 'code',
            data: {
              language: 'javascript',
              title: 'Enroll Leads via API',
              code: `// Enroll multiple leads in a sequence
const response = await fetch('/api/sequences/{sequenceId}/enroll', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    leadIds: ['lead-1', 'lead-2', 'lead-3']
  })
});

const result = await response.json();
// { enrolled: 3, failed: 0 }`,
            },
          },
          {
            type: 'alert',
            data: {
              type: 'warning',
              title: 'Duplicate Enrollment',
              message: 'Leads already enrolled in a sequence will be skipped automatically.',
            },
          },
        ],
      },
      {
        id: 'sequence-variables',
        title: 'Personalization Variables',
        content: [
          {
            type: 'paragraph',
            data: 'Use these variables in subject lines and email bodies for personalization:',
          },
          {
            type: 'table',
            data: {
              headers: ['Variable', 'Description', 'Example Output'],
              rows: [
                ['{{companyName}}', 'Lead company name', 'Acme Corp'],
                ['{{contactPerson}}', 'Lead contact name', 'John Smith'],
                ['{{leadCompanyName}}', 'Alternative company reference', 'Acme Corp'],
                ['{{email}}', 'Lead email address', 'john@acme.com'],
              ],
            },
          },
          {
            type: 'code',
            data: {
              language: 'html',
              title: 'Example Email Template',
              code: `Hi {{contactPerson}},

I noticed {{companyName}} is in the {{industry}} space. 
We've helped similar companies increase their lead generation by 40%.

Would you be open to a quick 15-minute call to discuss 
how we can help {{leadCompanyName}}?

Best regards,
Your Name`,
            },
          },
        ],
      },
    ],
  },

  // More topics continue...
  {
    id: 'deals-pipeline',
    title: 'Deals & Pipeline',
    slug: 'deals-pipeline',
    description: 'Manage your sales pipeline and forecast revenue',
    category: 'Features',
    order: 6,
    sections: [
      {
        id: 'deal-basics',
        title: 'Creating Deals',
        content: [
          {
            type: 'paragraph',
            data: 'Convert qualified leads into deals to track them through your sales pipeline.',
          },
          {
            type: 'steps',
            data: [
              {
                title: 'Qualify the Lead',
                description: 'Ensure needs, budget, and timeline are confirmed',
              },
              {
                title: 'Create Deal',
                description: 'Go to Deals → Create Deal or click on lead',
              },
              {
                title: 'Enter Deal Details',
                description: 'Title, value (in your currency), probability, expected close date',
              },
              {
                title: 'Link to Lead',
                description: 'Associate deal with existing lead record',
              },
              {
                title: 'Set Initial Stage',
                description: 'Usually starts at "New" or "Qualified"',
              },
            ],
          },
        ],
      },
      {
        id: 'pipeline-stages',
        title: 'Pipeline Stages',
        content: [
          {
            type: 'table',
            data: {
              headers: ['Stage', 'Typical Probability', 'Actions', 'Duration'],
              rows: [
                ['New', '10%', 'Schedule discovery call', '0-7 days'],
                ['Qualified', '25%', 'Send proposal/quote', '7-14 days'],
                ['Proposal', '50%', 'Follow up, answer questions', '14-21 days'],
                ['Negotiation', '75%', 'Finalize terms, pricing', '7-14 days'],
                ['Won', '100%', 'Onboard customer', '-'],
                ['Lost', '0%', 'Document reason, add to nurture', '-'],
              ],
            },
          },
        ],
      },
      {
        id: 'currency-support',
        title: 'Multi-Currency Support',
        content: [
          {
            type: 'paragraph',
            data: 'Supported codes include USD, EUR, GBP, INR, AUD, CAD, JPY, CNY, CHF, SGD, AED, BRL, MXN, ZAR. Resolution for new documents: form value → customer billing currency → company default (Settings → Payment) → personal preferred currency → INR. Existing invoices/deals keep their stored currency.',
          },
        ],
      },
    ],
  },

  // BEST PRACTICES
  {
    id: 'email-best-practices',
    title: 'Email Best Practices',
    slug: 'email-best-practices',
    description: 'Improve deliverability and engagement',
    category: 'Best Practices',
    order: 10,
    sections: [
      {
        id: 'deliverability',
        title: 'Email Deliverability',
        content: [
          {
            type: 'paragraph',
            data: 'Follow these guidelines to ensure your emails reach the inbox:',
          },
          {
            type: 'heading',
            data: { level: 4, text: '✅ Do' },
          },
          {
            type: 'list',
            data: {
              items: [
                'Warm up new email domains gradually (start with 20 emails/day, increase slowly)',
                'Use professional email addresses (not @gmail or @yahoo)',
                'Include physical address in footer (legal requirement)',
                'Make unsubscribe link prominent and functional',
                'Send from authenticated domain (SPF, DKIM, DMARC)',
                'Maintain consistent sending schedule',
                'Clean inactive subscribers monthly',
              ],
            },
          },
          {
            type: 'heading',
            data: { level: 4, text: '❌ Don\'t' },
          },
          {
            type: 'list',
            data: {
              items: [
                'Use ALL CAPS in subject lines',
                'Overuse exclamation marks!!!',
                'Include "Free", "Buy Now", "Act Now" excessively',
                'Send from no-reply@ addresses',
                'Send to purchased email lists',
                'Exceed 1 email per day per contact',
                'Ignore bounce rates above 5%',
              ],
            },
          },
        ],
      },
    ],
  },

  // ADMIN & EMPLOYEE
  {
    id: 'roles-access',
    title: 'Roles & access',
    slug: 'roles-access',
    description: 'Platform admin vs workspace admin vs employee vs customer',
    category: 'Admin & Employee',
    order: 10,
    sections: [
      {
        id: 'role-matrix',
        title: 'Role matrix',
        content: [
          {
            type: 'paragraph',
            data: 'Access is role-based and tenant-scoped. URLs always include the company slug except platform admin (/admin) and the shared customer portal (/portal).',
          },
          {
            type: 'table',
            data: {
              headers: ['Role', 'Entry URL', 'Can manage'],
              rows: [
                ['SUPER_ADMIN', '/admin', 'All tenants, plans, subscriptions, platform settings'],
                ['ADMIN', '/{slug}/dashboard', 'That company CRM + People + Workspace admin'],
                ['SALES / TECH / …', '/{slug}/dashboard', 'Modules allowed by plan + role nav'],
                ['EMPLOYEE', '/{slug}/employee/login', 'Own HR self-service (+ leads if LEADS module)'],
                ['CUSTOMER', '/portal', 'Own tickets, assets, quotes, invoices, contracts'],
              ],
            },
          },
          {
            type: 'alert',
            data: {
              type: 'info',
              title: 'Linked employee record',
              message: 'CRM users (ADMIN/SALES/TECH) with an Employee profile can also open the Employee portal for attendance, leave, and payslips.',
            },
          },
        ],
      },
      {
        id: 'end-to-end-paths',
        title: 'End-to-end paths',
        content: [
          {
            type: 'steps',
            data: [
              {
                title: 'Hire / register staff',
                description: 'Employee registers at /{slug}/employee/register → pending. Workspace admin approves under People → Approve staff or Workspace Admin → Approvals.',
              },
              {
                title: 'Grant CRM access',
                description: 'Workspace Admin → Users: assign role (ADMIN, SALES, etc.) and company membership.',
              },
              {
                title: 'Run payroll',
                description: 'People → Employees (salary) → Payroll generate/process → Employee sees Payslips.',
              },
              {
                title: 'Serve a client',
                description: 'Customers → invite to portal → client uses /portal for tickets, quotes, invoices.',
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'platform-admin',
    title: 'Platform admin',
    slug: 'platform-admin',
    description: 'SUPER_ADMIN console at /admin',
    category: 'Admin & Employee',
    order: 11,
    sections: [
      {
        id: 'platform-overview',
        title: 'What this console is for',
        content: [
          {
            type: 'paragraph',
            data: 'Platform admin is Opslane SaaS control — not a single customer’s CRM. Only SUPER_ADMIN can open /admin.',
          },
          {
            type: 'list',
            data: {
              items: [
                'Overview — high-level platform health',
                'Companies — list, inspect, approve/reject tenants',
                'Users — cross-tenant user lookup and feature overrides',
                'Subscriptions — tenant billing status',
                'Plans — plan catalog and feature modules',
                'Email logs — platform outbound mail audit',
                'Activity — audit trail',
                'Settings — tenancy mode (path vs subdomain) and platform knobs',
              ],
            },
          },
          {
            type: 'alert',
            data: {
              type: 'warning',
              title: 'Do not confuse with workspace admin',
              message: 'Company users, payroll, and CRM settings live under /{slug}/admin and /{slug}/dashboard — not /admin.',
            },
          },
        ],
      },
      {
        id: 'platform-companies',
        title: 'Companies & approvals',
        content: [
          {
            type: 'steps',
            data: [
              {
                title: 'Open Companies',
                description: 'Go to /admin/companies.',
              },
              {
                title: 'Review status',
                description: 'PENDING companies await platform approval before full use.',
              },
              {
                title: 'Approve or reject',
                description: 'Use approve flows so the tenant admin and employees unlock.',
              },
            ],
          },
        ],
      },
      {
        id: 'platform-plans',
        title: 'Plans & modules',
        content: [
          {
            type: 'paragraph',
            data: 'Plans gate feature modules (LEADS, INVOICES, INVENTORY, etc.). Sync modules after catalog changes. Tenant checkout still uses platform Razorpay keys; company Razorpay in Settings → Payment is for payroll / future customer checkout.',
          },
        ],
      },
    ],
  },
  {
    id: 'workspace-admin',
    title: 'Workspace admin',
    slug: 'workspace-admin',
    description: 'Company ADMIN: users, approvals, HR, settings',
    category: 'Admin & Employee',
    order: 12,
    sections: [
      {
        id: 'workspace-admin-home',
        title: 'Workspace admin home',
        content: [
          {
            type: 'paragraph',
            data: 'Open /{slug}/admin (ADMIN or SUPER_ADMIN). Cards link to workspace users and employee registration approvals.',
          },
          {
            type: 'list',
            data: {
              items: [
                'Users — people with access to this company',
                'Approvals — pending employee registrations',
              ],
            },
          },
        ],
      },
      {
        id: 'people-hr',
        title: 'People & HR (admin)',
        content: [
          {
            type: 'paragraph',
            data: 'From the main dashboard sidebar (People group), ADMIN can manage the workforce:',
          },
          {
            type: 'table',
            data: {
              headers: ['Nav', 'Path', 'Purpose'],
              rows: [
                ['Employees', '/{slug}/dashboard/employees', 'Directory, profiles, salaries'],
                ['Approve staff', '/{slug}/dashboard/approve-employees', 'Approve pending HR registrations'],
                ['Payroll', '/{slug}/dashboard/payroll', 'Generate, process, mark paid'],
              ],
            },
          },
          {
            type: 'steps',
            data: [
              {
                title: 'Create or approve employee',
                description: 'Add via Employees, or approve a self-registration from Approve staff / Workspace Admin → Approvals.',
              },
              {
                title: 'Set salary',
                description: 'Open employee → salary form. Required before meaningful payslips.',
              },
              {
                title: 'Run payroll',
                description: 'Payroll → generate for period → process. Optional company Razorpay under Settings → Payment for payouts.',
              },
              {
                title: 'Employee views payslip',
                description: 'Employee portal → Payslips (download when available).',
              },
            ],
          },
        ],
      },
      {
        id: 'workspace-settings',
        title: 'Company settings checklist',
        content: [
          {
            type: 'list',
            data: {
              ordered: true,
              items: [
                'Basic info — name, logo, contact',
                'Business — vertical, terminology, ticket types',
                'Customization — theme, date format, timezone',
                'Payment — company default currency + Razorpay credentials',
                'Security — session / password policy',
                'Pipelines — lead/deal stages under Settings',
              ],
            },
          },
        ],
      },
      {
        id: 'billing-clients',
        title: 'Client billing (admin side)',
        content: [
          {
            type: 'paragraph',
            data: 'Create quotations and invoices from the dashboard. Record payments on the invoice detail page when bank/UPI/cash clears. Clients see the same docs in /portal. Set Customer → Billing currency when a client invoices in a different currency than company default.',
          },
        ],
      },
      {
        id: 'ops-agent',
        title: 'Ops Agent',
        content: [
          {
            type: 'paragraph',
            data: 'Each company gets OPS (Gemini function calling). Staff open it from the floating bot on any dashboard page. Chats are saved per user; use the back button to browse history. Attach screenshots for vision analysis. Write actions need confirm in the UI. Models are discovered live with a fallback chain. OPS can run day-to-day company ops end-to-end (CRM, service, finance, field, HR reads).',
          },
          {
            type: 'list',
            data: {
              items: [
                'Read: KPIs, customers/leads/deals/tickets/contracts, SLA breaches, docs search, expenses, sequences, inventory/assets, attendance/GPS, notifications, payroll summary (ADMIN)',
                'Write (confirm first): create customer/lead, tasks, tickets (+ assign/status/service report), deals/lead status, quotes/invoices (+ send/pay), sequences (enroll/pause), calendar, WhatsApp/email, expense approve, announcements, teammate DMs',
                'Screenshots: paste or attach — kept on your device only; sent to Gemini for that turn',
                'Not available to CUSTOMER or EMPLOYEE portal users',
              ],
            },
          },
        ],
      },
    ],
  },
  {
    id: 'employee-portal',
    title: 'Employee portal',
    slug: 'employee-portal',
    description: 'Self-service HR and day-to-day work',
    category: 'Admin & Employee',
    order: 13,
    sections: [
      {
        id: 'employee-access',
        title: 'How to get in',
        content: [
          {
            type: 'steps',
            data: [
              {
                title: 'Register (new hires)',
                description: 'Go to /{slug}/employee/register. Wait for workspace admin approval.',
              },
              {
                title: 'Sign in',
                description: 'Go to /{slug}/employee/login. EMPLOYEE role, or any staff user with an employeeId, can enter.',
              },
              {
                title: 'Land on dashboard',
                description: '/{slug}/employee/dashboard shows attendance, leave, tasks, and announcements summary.',
              },
            ],
          },
        ],
      },
      {
        id: 'employee-nav',
        title: 'What you can do',
        content: [
          {
            type: 'table',
            data: {
              headers: ['Area', 'Path', 'Notes'],
              rows: [
                ['Dashboard', '/employee/dashboard', 'Today’s snapshot'],
                ['Profile', '/employee/profile', 'Personal details'],
                ['Attendance', '/employee/attendance', 'Check-in / check-out'],
                ['Leave', '/employee/leave', 'Request leave; see balance'],
                ['Payslips', '/employee/payslips', 'View / download (history UI still thin)'],
                ['Leads', '/employee/leads', 'Only if plan module LEADS is on'],
                ['My work', '/dashboard/projects/my-work', 'Assigned project delivery tasks'],
                ['Messages', '/employee/messages', 'Internal messaging'],
                ['Announcements', '/employee/announcements', 'Company announcements'],
              ],
            },
          },
          {
            type: 'alert',
            data: {
              type: 'info',
              title: 'Not the CRM dashboard',
              message: 'Full deals, invoices, and tickets for sales/ops live under /{slug}/dashboard. Employee portal is primarily HR self-service; delivery work uses My work (ProjectTasks) under the Projects module.',
            },
          },
        ],
      },
      {
        id: 'employee-attendance-leave',
        title: 'Attendance & leave flow',
        content: [
          {
            type: 'steps',
            data: [
              {
                title: 'Check in',
                description: 'Attendance → check in at start of day (API: /api/employee/attendance/check-in).',
              },
              {
                title: 'Check out',
                description: 'Check out when finished.',
              },
              {
                title: 'Request leave',
                description: 'Leave → new request. Admin reviews from HR tools; balance updates when approved.',
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'customer-portal-docs',
    title: 'Customer portal',
    slug: 'customer-portal',
    description: 'What clients see in /portal',
    category: 'Admin & Employee',
    order: 14,
    sections: [
      {
        id: 'portal-overview',
        title: 'Client self-service',
        content: [
          {
            type: 'paragraph',
            data: 'Invite customers from the customer detail page. They sign in to /portal (not the company dashboard).',
          },
          {
            type: 'list',
            data: {
              items: [
                'Tickets — create and track support requests',
                'Equipment / warranties / service history — when those workspace features are on',
                'Quotations — review, approve, or decline',
                'Invoices — view, PDF, bank payment instructions',
                'Documents — invoices, quotes, and service contracts',
                'Contracts — open AMC/CMC coverage details',
              ],
            },
          },
          {
            type: 'alert',
            data: {
              type: 'warning',
              title: 'Payments',
              message: 'Clients pay via bank details on the invoice today. Staff record clearance with Record payment on the invoice. Online Razorpay checkout for CRM invoices is not enabled yet.',
            },
          },
        ],
      },
    ],
  },

  // API REFERENCE
  {
    id: 'api-overview',
    title: 'API Overview',
    slug: 'api-overview',
    description: 'REST API for integrations',
    category: 'API Reference',
    order: 20,
    sections: [
      {
        id: 'authentication',
        title: 'Authentication',
        content: [
          {
            type: 'paragraph',
            data: 'All API endpoints require authentication via NextAuth session. Include session cookies with your requests. Tenant routes usually need the workspace slug header when calling from multi-company contexts.',
          },
          {
            type: 'code',
            data: {
              language: 'javascript',
              title: 'API Authentication Example',
              code: `// Client-side API call (automatically includes session)
const response = await fetch('/api/leads', {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json'
  }
});

const leads = await response.json();`,
            },
          },
        ],
      },
      {
        id: 'api-endpoints',
        title: 'Available Endpoints',
        content: [
          {
            type: 'table',
            data: {
              headers: ['Method', 'Endpoint', 'Description'],
              rows: [
                ['GET', '/api/leads', 'Fetch all leads with pagination'],
                ['POST', '/api/leads', 'Create new lead'],
                ['PATCH', '/api/leads/:id', 'Update lead'],
                ['DELETE', '/api/leads/:id', 'Delete lead'],
                ['GET', '/api/sequences', 'Get user sequences'],
                ['POST', '/api/sequences', 'Create sequence'],
                ['POST', '/api/sequences/:id/enroll', 'Enroll leads'],
                ['GET', '/api/campaigns', 'Fetch campaigns'],
                ['POST', '/api/campaigns', 'Create campaign'],
                ['POST', '/api/campaigns/:id/send', 'Send campaign'],
                ['GET', '/api/deals', 'Get all deals'],
                ['POST', '/api/deals', 'Create deal'],
                ['PATCH', '/api/deals/:id', 'Update deal'],
                ['POST', '/api/invoices/:id/payment', 'Record invoice payment (staff)'],
                ['GET', '/api/employee/attendance/today', 'Employee attendance today'],
                ['GET', '/api/portal/invoices', 'Customer portal invoices'],
              ],
            },
          },
        ],
      },
    ],
  },
];

// Helper functions
export function getTopicBySlug(slug: string): DocTopic | undefined {
  return documentationTopics.find(topic => topic.slug === slug);
}

export function getTopicsByCategory(category: string): DocTopic[] {
  return documentationTopics
    .filter(topic => topic.category === category)
    .sort((a, b) => a.order - b.order);
}

export function getAllCategories(): string[] {
  return Array.from(new Set(documentationTopics.map(t => t.category)));
}

export function searchDocumentation(query: string): DocTopic[] {
  const lowercaseQuery = query.toLowerCase();
  return documentationTopics.filter(topic => {
    return (
      topic.title.toLowerCase().includes(lowercaseQuery) ||
      topic.description?.toLowerCase().includes(lowercaseQuery) ||
      JSON.stringify(topic.sections).toLowerCase().includes(lowercaseQuery)
    );
  });
}

export function getTableOfContents(topic: DocTopic): Array<{ id: string; title: string }> {
  return topic.sections.map(section => ({
    id: section.id,
    title: section.title,
  }));
}
