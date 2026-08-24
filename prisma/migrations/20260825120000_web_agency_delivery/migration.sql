-- Web agency delivery: project progress, milestones, members, retainers, ticket/project link

ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "projectType" TEXT NOT NULL DEFAULT 'other';
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "progress" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "pmUserId" TEXT;

CREATE INDEX IF NOT EXISTS "Project_pmUserId_idx" ON "Project"("pmUserId");
CREATE INDEX IF NOT EXISTS "Project_status_idx" ON "Project"("status");

DO $$ BEGIN
  ALTER TABLE "Project" ADD CONSTRAINT "Project_pmUserId_fkey"
    FOREIGN KEY ("pmUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "ProjectMilestone" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "dueDate" TIMESTAMP(3),
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProjectMilestone_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ProjectMilestone_projectId_idx" ON "ProjectMilestone"("projectId");
CREATE INDEX IF NOT EXISTS "ProjectMilestone_status_idx" ON "ProjectMilestone"("status");
CREATE INDEX IF NOT EXISTS "ProjectMilestone_dueDate_idx" ON "ProjectMilestone"("dueDate");

DO $$ BEGIN
  ALTER TABLE "ProjectMilestone" ADD CONSTRAINT "ProjectMilestone_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "ProjectMember" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'OTHER',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectMember_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProjectMember_projectId_userId_key" ON "ProjectMember"("projectId", "userId");
CREATE INDEX IF NOT EXISTS "ProjectMember_projectId_idx" ON "ProjectMember"("projectId");
CREATE INDEX IF NOT EXISTS "ProjectMember_userId_idx" ON "ProjectMember"("userId");

DO $$ BEGIN
  ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "ClientRetainer" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "projectId" TEXT,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "amount" DOUBLE PRECISION NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "billingCycle" TEXT NOT NULL DEFAULT 'MONTHLY',
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "nextBillAt" TIMESTAMP(3),
  "lastBilledAt" TIMESTAMP(3),
  "endDate" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClientRetainer_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ClientRetainer_companyId_idx" ON "ClientRetainer"("companyId");
CREATE INDEX IF NOT EXISTS "ClientRetainer_customerId_idx" ON "ClientRetainer"("customerId");
CREATE INDEX IF NOT EXISTS "ClientRetainer_projectId_idx" ON "ClientRetainer"("projectId");
CREATE INDEX IF NOT EXISTS "ClientRetainer_status_idx" ON "ClientRetainer"("status");
CREATE INDEX IF NOT EXISTS "ClientRetainer_nextBillAt_idx" ON "ClientRetainer"("nextBillAt");

DO $$ BEGIN
  ALTER TABLE "ClientRetainer" ADD CONSTRAINT "ClientRetainer_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ClientRetainer" ADD CONSTRAINT "ClientRetainer_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ClientRetainer" ADD CONSTRAINT "ClientRetainer_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "SupportTicket" ADD COLUMN IF NOT EXISTS "projectId" TEXT;
CREATE INDEX IF NOT EXISTS "SupportTicket_projectId_idx" ON "SupportTicket"("projectId");

DO $$ BEGIN
  ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "TimesheetEntry" ADD COLUMN IF NOT EXISTS "billable" BOOLEAN NOT NULL DEFAULT true;
CREATE INDEX IF NOT EXISTS "TimesheetEntry_projectId_idx" ON "TimesheetEntry"("projectId");

DO $$ BEGIN
  ALTER TABLE "TimesheetEntry" ADD CONSTRAINT "TimesheetEntry_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
