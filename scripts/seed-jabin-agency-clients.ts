import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';

const PORTAL_DEV_PASSWORD = 'Demo@12345';

const CLIENTS = [
  {
    projectName: 'Sciolabs',
    contactPerson: 'Davis Abraham',
    website: 'https://sciolabs.in/',
    organizationName: 'ScioLabs',
    email: 'davis@sciolabs.in',
    industry: 'Education / Training',
    description:
      'Upward equipping through training, guidance, innovation, and curricula — ScioThrive, ScioSprints, ScioLingua, ScioCare, ScioGuidance.',
    projectType: 'webapp',
  },
  {
    projectName: 'NIBS',
    contactPerson: 'Henry John',
    website: 'https://nibsindia.com/',
    organizationName: 'North India Baptist Seminary',
    email: 'NIBSeminary@gmail.com',
    industry: 'Education / Seminary',
    description:
      'Bilingual modular Baptist seminary in Patiala — degree programs, admissions, and student portal.',
    projectType: 'website',
  },
  {
    projectName: 'Sparkplug',
    contactPerson: 'Blesson Joseph',
    website: 'https://www.thesparkplug.in/',
    organizationName: 'Sparkplug',
    email: 'connect@thesparkplug.in',
    industry: 'Corporate Experiences',
    description:
      'High-energy audience engagement — corporate drum circles, team-building, and wellness experiences across India.',
    projectType: 'website',
  },
  {
    projectName: 'Empowered',
    contactPerson: 'Annie Samuel',
    website: 'https://empowered.ngo/',
    organizationName: 'EmpowerEd Foundation',
    email: 'hello@empowered.ngo',
    industry: 'Nonprofit / Education',
    description:
      'Empowering marginalised children through education in Kerala — BEGIN, BLOOM, BLAZE programmes.',
    projectType: 'website',
  },
  {
    projectName: 'Jude Rockwell',
    contactPerson: 'Henry Samson',
    website: 'https://jraedu.com/',
    organizationName: 'Jude Rockwell Academy',
    email: 'admissions@jraedu.com',
    industry: 'Education / School',
    description:
      'English medium school in B.K.T, Lucknow — Classes 1–8, admissions, academics, and campus life.',
    projectType: 'website',
  },
] as const;

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: 'harshit@jabin.org' },
    select: {
      id: true,
      email: true,
      name: true,
      companyId: true,
      primaryCompanyId: true,
    },
  });

  if (!user) {
    throw new Error('User harshit@jabin.org not found');
  }

  let companyId = user.companyId || user.primaryCompanyId || null;

  if (!companyId) {
    const membership = await prisma.userCompany.findFirst({
      where: { userId: user.id },
      select: { companyId: true },
    });
    companyId = membership?.companyId ?? null;
  }

  if (!companyId) {
    throw new Error('No company linked to harshit@jabin.org');
  }

  const company = await prisma.company.findUniqueOrThrow({
    where: { id: companyId },
    select: { id: true, name: true, slug: true },
  });

  console.log(`Seeding for ${user.email} → ${company.name} (${company.slug})`);

  const results: Array<{ client: string; project: string; customerId: string; projectId: string }> =
    [];

  for (const row of CLIENTS) {
    let customer = await prisma.customer.findFirst({
      where: {
        companyId: company.id,
        organizationName: row.organizationName,
      },
    });

    if (!customer) {
      customer = await prisma.customer.findFirst({
        where: {
          companyId: company.id,
          email: row.email,
        },
      });
    }

    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          organizationName: row.organizationName,
          contactPerson: row.contactPerson,
          email: row.email,
          industry: row.industry,
          notes: `Website: ${row.website}\nSeeded for Jabin Web agency workspace.`,
          companyId: company.id,
          accountType: 'CLIENT',
        },
      });
      console.log(`  + Client: ${customer.organizationName}`);
    } else {
      customer = await prisma.customer.update({
        where: { id: customer.id },
        data: {
          contactPerson: row.contactPerson,
          email: row.email,
          industry: row.industry,
          notes: `Website: ${row.website}\nSeeded for Jabin Web agency workspace.`,
        },
      });
      console.log(`  ~ Client: ${customer.organizationName}`);
    }

    // Contact person record
    const existingContact = await prisma.customerContact.findFirst({
      where: {
        customerId: customer.id,
        OR: [{ email: row.email }, { name: row.contactPerson }],
      },
    });
    if (!existingContact) {
      await prisma.customerContact.create({
        data: {
          customerId: customer.id,
          name: row.contactPerson,
          email: row.email,
          isPrimary: true,
          title: 'Primary contact',
        },
      });
    }

    let project = await prisma.project.findFirst({
      where: {
        companyId: company.id,
        name: row.projectName,
        customerId: customer.id,
      },
    });

    const start = new Date();
    const end = new Date();
    end.setMonth(end.getMonth() + 6);

    if (!project) {
      project = await prisma.project.create({
        data: {
          name: row.projectName,
          description: `${row.description}\n\nLive: ${row.website}`,
          status: 'ACTIVE',
          projectType: row.projectType,
          progress: 40,
          startDate: start,
          endDate: end,
          companyId: company.id,
          customerId: customer.id,
          pmUserId: user.id,
          milestones: {
            create: [
              { title: 'Discovery & brief', sortOrder: 0, status: 'DONE', completedAt: start },
              { title: 'Design / UX', sortOrder: 1, status: 'DONE', completedAt: start },
              { title: 'Build / development', sortOrder: 2, status: 'IN_PROGRESS' },
              { title: 'QA & revisions', sortOrder: 3, status: 'PENDING' },
              { title: 'Launch', sortOrder: 4, status: 'PENDING' },
            ],
          },
        },
      });
      // Recalc progress from milestones (2/5 done = 40%)
      console.log(`  + Project: ${project.name}`);
    } else {
      project = await prisma.project.update({
        where: { id: project.id },
        data: {
          description: `${row.description}\n\nLive: ${row.website}`,
          status: 'ACTIVE',
          projectType: row.projectType,
          pmUserId: user.id,
          customerId: customer.id,
        },
      });
      const milestoneCount = await prisma.projectMilestone.count({
        where: { projectId: project.id },
      });
      if (milestoneCount === 0) {
        await prisma.projectMilestone.createMany({
          data: [
            {
              projectId: project.id,
              title: 'Discovery & brief',
              sortOrder: 0,
              status: 'DONE',
              completedAt: start,
            },
            {
              projectId: project.id,
              title: 'Design / UX',
              sortOrder: 1,
              status: 'DONE',
              completedAt: start,
            },
            {
              projectId: project.id,
              title: 'Build / development',
              sortOrder: 2,
              status: 'IN_PROGRESS',
            },
            {
              projectId: project.id,
              title: 'QA & revisions',
              sortOrder: 3,
              status: 'PENDING',
            },
            { projectId: project.id, title: 'Launch', sortOrder: 4, status: 'PENDING' },
          ],
        });
        await prisma.project.update({
          where: { id: project.id },
          data: { progress: 40 },
        });
      }
      console.log(`  ~ Project: ${project.name}`);
    }

    const portalPasswordHash = await bcrypt.hash(PORTAL_DEV_PASSWORD, 12);
    const portalUser = await prisma.user.upsert({
      where: { email: row.email.toLowerCase() },
      create: {
        email: row.email.toLowerCase(),
        name: row.contactPerson,
        password: portalPasswordHash,
        role: 'CUSTOMER',
        userStatus: 'ACTIVE',
        companyId: company.id,
        primaryCompanyId: company.id,
        customerId: customer.id,
      },
      update: {
        name: row.contactPerson,
        password: portalPasswordHash,
        role: 'CUSTOMER',
        userStatus: 'ACTIVE',
        companyId: company.id,
        primaryCompanyId: company.id,
        customerId: customer.id,
      },
    });
    console.log(`  + Portal: ${portalUser.email} → ${customer.organizationName}`);

    results.push({
      client: customer.organizationName,
      project: project.name,
      customerId: customer.id,
      projectId: project.id,
    });
  }

  console.log('\nDone:');
  for (const r of results) {
    console.log(`  ${r.project} → ${r.client} (${r.projectId})`);
  }
  console.log(`\nPortal sign-in (all clients): password ${PORTAL_DEV_PASSWORD} at /auth/signin → /portal`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});