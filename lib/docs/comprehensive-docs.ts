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
    description: 'Welcome to the Lead Generation & CRM Platform',
    category: 'Getting Started',
    order: 1,
    sections: [
      {
        id: 'welcome',
        title: 'Welcome',
        content: [
          {
            type: 'paragraph',
            data: 'This platform is a comprehensive Lead Generation and CRM system designed to help you capture, nurture, and convert leads into customers. Built with Next.js 14, React 19, and powered by PostgreSQL, it offers enterprise-grade features for modern sales teams.',
          },
          {
            type: 'heading',
            data: { level: 3, text: 'What You Can Do' },
          },
          {
            type: 'list',
            data: {
              items: [
                'Capture leads from multiple sources (manual entry, CSV import, web scraping)',
                'Automatically score and qualify leads based on engagement',
                'Send one-time email campaigns to thousands of recipients',
                'Create automated email sequences with conditional logic',
                'Manage your sales pipeline with multi-currency support',
                'Track meetings and events with Google Calendar integration',
                'Analyze performance with comprehensive analytics',
                'Collaborate with your team on deals and leads',
              ],
            },
          },
          {
            type: 'alert',
            data: {
              type: 'info',
              title: 'First Time Here?',
              message: 'Start with the Quick Start Guide to get your account set up in under 5 minutes.',
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
    description: 'Get up and running in 5 minutes',
    category: 'Getting Started',
    order: 2,
    sections: [
      {
        id: 'setup',
        title: 'Initial Setup',
        content: [
          {
            type: 'steps',
            data: [
              {
                title: 'Sign In',
                description: 'Sign in with your Google account. The platform uses NextAuth for secure authentication.',
              },
              {
                title: 'Complete Your Profile',
                description: 'Navigate to Settings and fill in your profile details including name, company, and phone number.',
              },
              {
                title: 'Set Currency Preference',
                description: 'Choose your preferred currency from 14 supported currencies (USD, EUR, GBP, INR, etc.). This affects all deal values throughout the platform.',
              },
              {
                title: 'Configure Email Settings',
                description: 'Set up SMTP configuration in Settings > Email Settings to send campaigns and sequences.',
              },
              {
                title: 'Invite Team Members (Optional)',
                description: 'Go to Team page to invite colleagues with different permission levels.',
              },
            ],
          },
          {
            type: 'alert',
            data: {
              type: 'success',
              title: 'Ready to Go!',
              message: "Once you've completed these steps, you're ready to start adding leads and creating campaigns.",
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
            data: 'The platform supports 14 currencies. Set your preference in Settings and all deal values will display in your chosen currency.',
          },
          {
            type: 'list',
            data: {
              items: [
                'USD - US Dollar ($)',
                'EUR - Euro (€)',
                'GBP - British Pound (£)',
                'INR - Indian Rupee (₹)',
                'AUD - Australian Dollar',
                'CAD - Canadian Dollar',
                'JPY - Japanese Yen (¥)',
                'CNY - Chinese Yuan',
                'CHF - Swiss Franc',
                'SGD - Singapore Dollar',
                'AED - UAE Dirham',
                'BRL - Brazilian Real',
                'MXN - Mexican Peso',
                'ZAR - South African Rand',
              ],
            },
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

  // API REFERENCE
  {
    id: 'api-overview',
    title: 'API Overview',
    slug: 'api-overview',
    description: 'REST API for integrations',
    category: 'API Reference',
    order: 15,
    sections: [
      {
        id: 'authentication',
        title: 'Authentication',
        content: [
          {
            type: 'paragraph',
            data: 'All API endpoints require authentication via NextAuth session. Include session cookies with your requests.',
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
