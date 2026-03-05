const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database with subscription plans...');

  // Create Free Plan
  const freePlan = await prisma.plan.upsert({
    where: { name: 'free' },
    update: {},
    create: {
      name: 'free',
      displayName: 'Free',
      description: 'Perfect for trying out our platform',
      price: 0,
      currency: 'INR',
      interval: 'month',
      maxLeads: 20,
      maxEmails: 50,
      maxCampaigns: 2,
      features: [
        '20 leads per month',
        '50 emails per month',
        '2 active campaigns',
        'Email templates',
        'Basic analytics',
      ],
      isActive: true,
    },
  });

  // Create Starter Plan
  const starterPlan = await prisma.plan.upsert({
    where: { name: 'starter' },
    update: {},
    create: {
      name: 'starter',
      displayName: 'Starter',
      description: 'Great for small businesses and startups',
      price: 99900, // ₹999 in paise
      currency: 'INR',
      interval: 'month',
      maxLeads: 500,
      maxEmails: 2000,
      maxCampaigns: 10,
      features: [
        '500 leads per month',
        '2,000 emails per month',
        '10 active campaigns',
        'Email templates',
        'AI email generation',
        'Lead enrichment',
        'Priority support',
        'Advanced analytics',
      ],
      isActive: true,
    },
  });

  // Create Professional Plan
  const proPlan = await prisma.plan.upsert({
    where: { name: 'professional' },
    update: {},
    create: {
      name: 'professional',
      displayName: 'Professional',
      description: 'For growing businesses with serious lead generation needs',
      price: 299900, // ₹2,999 in paise
      currency: 'INR',
      interval: 'month',
      maxLeads: 2000,
      maxEmails: 10000,
      maxCampaigns: 50,
      features: [
        '2,000 leads per month',
        '10,000 emails per month',
        '50 active campaigns',
        'Email templates',
        'AI email generation',
        'Advanced lead enrichment',
        'Duplicate detection & merging',
        'Email tracking & analytics',
        'Custom integrations',
        'Priority support',
        'Advanced analytics & reports',
      ],
      isActive: true,
    },
  });

  // Create Enterprise Plan
  const enterprisePlan = await prisma.plan.upsert({
    where: { name: 'enterprise' },
    update: {},
    create: {
      name: 'enterprise',
      displayName: 'Enterprise',
      description: 'Unlimited everything for large organizations',
      price: 799900, // ₹7,999 in paise
      currency: 'INR',
      interval: 'month',
      maxLeads: -1, // Unlimited
      maxEmails: -1, // Unlimited
      maxCampaigns: -1, // Unlimited
      features: [
        'Unlimited leads',
        'Unlimited emails',
        'Unlimited campaigns',
        'Email templates',
        'AI email generation',
        'Advanced lead enrichment',
        'Duplicate detection & merging',
        'Email tracking & analytics',
        'Custom integrations',
        'API access',
        'White-label options',
        'Dedicated account manager',
        '24/7 priority support',
        'Custom analytics & reports',
      ],
      isActive: true,
    },
  });

  console.log('✅ Successfully seeded plans:');
  console.log('   - Free Plan:', freePlan.id);
  console.log('   - Starter Plan:', starterPlan.id);
  console.log('   - Professional Plan:', proPlan.id);
  console.log('   - Enterprise Plan:', enterprisePlan.id);

  // Find or create user
  console.log('\nSeeding invoices and quotations...');
  const user = await prisma.user.findUnique({
    where: { email: 'jabincreators@gmail.com' },
  });

  if (!user) {
    console.log('❌ User with email jabincreators@gmail.com not found. Skipping invoice and quotation seeding.');
  } else {
    console.log(`✅ Found user: ${user.email}`);

    // Create some quotations
    const quotation1 = await prisma.quotation.create({
      data: {
        userId: user.id,
        quotationNumber: 'QT-2026-001',
        title: 'Website Development Proposal',
        description: 'Full-stack web development services for e-commerce platform',
        customerName: 'Tech Solutions Inc',
        customerEmail: 'contact@techsolutions.com',
        customerPhone: '+1-555-0123',
        customerAddress: '123 Tech Street, San Francisco, CA 94105',
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: 'SENT',
        currency: 'USD',
        taxRate: 10,
        discount: 500,
        subtotal: 15000,
        taxAmount: 1500,
        total: 16000,
        terms: 'Payment terms: 50% upfront, 50% on completion',
        notes: 'Includes responsive design, payment integration, and admin dashboard',
        items: {
          create: [
            {
              name: 'UI/UX Design',
              description: 'Complete user interface and experience design',
              quantity: 1,
              unitPrice: 3000,
              amount: 3000,
            },
            {
              name: 'Frontend Development',
              description: 'React-based frontend with responsive design',
              quantity: 1,
              unitPrice: 5000,
              amount: 5000,
            },
            {
              name: 'Backend Development',
              description: 'Node.js API with database integration',
              quantity: 1,
              unitPrice: 5000,
              amount: 5000,
            },
            {
              name: 'Testing & Deployment',
              description: 'QA testing and production deployment',
              quantity: 1,
              unitPrice: 2000,
              amount: 2000,
            },
          ],
        },
      },
    });

    const quotation2 = await prisma.quotation.create({
      data: {
        userId: user.id,
        quotationNumber: 'QT-2026-002',
        title: 'Digital Marketing Campaign',
        description: 'Comprehensive digital marketing strategy and execution',
        customerName: 'Growth Marketing Co',
        customerEmail: 'hello@growthmarketing.co',
        customerPhone: '+1-555-0456',
        customerAddress: '456 Marketing Ave, New York, NY 10001',
        validUntil: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
        status: 'ACCEPTED',
        currency: 'USD',
        taxRate: 8,
        discount: 0,
        subtotal: 8500,
        taxAmount: 680,
        total: 9180,
        terms: 'Monthly retainer basis',
        notes: 'Campaign includes SEO, social media, and email marketing',
        items: {
          create: [
            {
              name: 'SEO Optimization',
              description: 'Monthly SEO services including keyword research and content optimization',
              quantity: 3,
              unitPrice: 1500,
              amount: 4500,
            },
            {
              name: 'Social Media Management',
              description: 'Daily posts and community management across 3 platforms',
              quantity: 3,
              unitPrice: 800,
              amount: 2400,
            },
            {
              name: 'Email Marketing',
              description: 'Weekly newsletter and promotional campaigns',
              quantity: 3,
              unitPrice: 533.33,
              amount: 1600,
            },
          ],
        },
      },
    });

    // Create some invoices
    const invoice1 = await prisma.invoice.create({
      data: {
        userId: user.id,
        title: 'Website Development - Phase 1',
        description: 'First phase payment for website development project',
        customerName: 'Tech Solutions Inc',
        customerEmail: 'contact@techsolutions.com',
        customerPhone: '+1-555-0123',
        customerAddress: '123 Tech Street, San Francisco, CA 94105',
        invoiceNumber: 'INV-2026-001',
        dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
        status: 'PAID',
        currency: 'USD',
        taxRate: 10,
        discount: 0,
        subtotal: 8000,
        taxAmount: 800,
        total: 8800,
        amountPaid: 8800,
        amountDue: 0,
        terms: 'Payment due within 15 days',
        notes: 'Thank you for your business!',
        items: {
          create: [
            {
              name: 'UI/UX Design',
              description: 'Complete user interface and experience design',
              quantity: 1,
              unitPrice: 3000,
              amount: 3000,
            },
            {
              name: 'Frontend Development (50%)',
              description: 'First phase of React-based frontend development',
              quantity: 1,
              unitPrice: 5000,
              amount: 5000,
            },
          ],
        },
      },
    });

    const invoice2 = await prisma.invoice.create({
      data: {
        userId: user.id,
        title: 'Digital Marketing - January 2026',
        description: 'Monthly digital marketing services for January',
        customerName: 'Growth Marketing Co',
        customerEmail: 'hello@growthmarketing.co',
        customerPhone: '+1-555-0456',
        customerAddress: '456 Marketing Ave, New York, NY 10001',
        invoiceNumber: 'INV-2026-002',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        status: 'SENT',
        currency: 'USD',
        taxRate: 8,
        discount: 200,
        subtotal: 8500,
        taxAmount: 680,
        total: 8980,
        amountPaid: 0,
        amountDue: 8980,
        terms: 'Payment due within 7 days',
        notes: 'Monthly retainer invoice',
        items: {
          create: [
            {
              name: 'SEO Optimization',
              description: 'Monthly SEO services',
              quantity: 3,
              unitPrice: 1500,
              amount: 4500,
            },
            {
              name: 'Social Media Management',
              description: 'Daily posts and community management',
              quantity: 3,
              unitPrice: 800,
              amount: 2400,
            },
            {
              name: 'Email Marketing',
              description: 'Weekly newsletter campaigns',
              quantity: 3,
              unitPrice: 533.33,
              amount: 1600,
            },
          ],
        },
      },
    });

    const invoice3 = await prisma.invoice.create({
      data: {
        userId: user.id,
        title: 'Mobile App Consultation',
        description: 'Initial consultation and requirement analysis for mobile app development',
        customerName: 'Startup Innovations Ltd',
        customerEmail: 'info@startupinnovations.com',
        customerPhone: '+1-555-0789',
        customerAddress: '789 Innovation Blvd, Austin, TX 78701',
        invoiceNumber: 'INV-2026-003',
        dueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // Overdue
        status: 'OVERDUE',
        currency: 'USD',
        taxRate: 10,
        discount: 0,
        subtotal: 2500,
        taxAmount: 250,
        total: 2750,
        amountPaid: 0,
        amountDue: 2750,
        terms: 'Payment was due 5 days ago',
        notes: 'Please remit payment at your earliest convenience',
        items: {
          create: [
            {
              name: 'Consultation Services',
              description: 'Technical consultation and requirement gathering',
              quantity: 5,
              unitPrice: 500,
              amount: 2500,
            },
          ],
        },
      },
    });

    console.log('✅ Successfully seeded quotations:');
    console.log('   - Quotation 1:', quotation1.id, '(SENT)');
    console.log('   - Quotation 2:', quotation2.id, '(ACCEPTED)');
    console.log('✅ Successfully seeded invoices:');
    console.log('   - Invoice 1:', invoice1.id, '(PAID)');
    console.log('   - Invoice 2:', invoice2.id, '(SENT)');
    console.log('   - Invoice 3:', invoice3.id, '(OVERDUE)');
  }
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
