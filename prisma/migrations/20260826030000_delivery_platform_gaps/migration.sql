-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'PROJECT_TASK_ASSIGNED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'PROJECT_TASK_COMMENTED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'PROJECT_TASK_UPDATED';

-- AlterTable TimesheetEntry
ALTER TABLE "TimesheetEntry" ADD COLUMN IF NOT EXISTS "projectTaskId" TEXT;
CREATE INDEX IF NOT EXISTS "TimesheetEntry_projectTaskId_idx" ON "TimesheetEntry"("projectTaskId");

DO $$ BEGIN
  ALTER TABLE "TimesheetEntry" ADD CONSTRAINT "TimesheetEntry_projectTaskId_fkey"
    FOREIGN KEY ("projectTaskId") REFERENCES "ProjectTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ProjectLabel
CREATE TABLE IF NOT EXISTS "ProjectLabel" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "color" TEXT NOT NULL DEFAULT 'slate',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectLabel_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ProjectLabel_companyId_name_key" ON "ProjectLabel"("companyId", "name");
CREATE INDEX IF NOT EXISTS "ProjectLabel_companyId_idx" ON "ProjectLabel"("companyId");
DO $$ BEGIN
  ALTER TABLE "ProjectLabel" ADD CONSTRAINT "ProjectLabel_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ProjectTaskLabel
CREATE TABLE IF NOT EXISTS "ProjectTaskLabel" (
  "taskId" TEXT NOT NULL,
  "labelId" TEXT NOT NULL,
  CONSTRAINT "ProjectTaskLabel_pkey" PRIMARY KEY ("taskId","labelId")
);
CREATE INDEX IF NOT EXISTS "ProjectTaskLabel_labelId_idx" ON "ProjectTaskLabel"("labelId");
DO $$ BEGIN
  ALTER TABLE "ProjectTaskLabel" ADD CONSTRAINT "ProjectTaskLabel_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "ProjectTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "ProjectTaskLabel" ADD CONSTRAINT "ProjectTaskLabel_labelId_fkey"
    FOREIGN KEY ("labelId") REFERENCES "ProjectLabel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ProjectTaskLinkType
DO $$ BEGIN
  CREATE TYPE "ProjectTaskLinkType" AS ENUM ('BLOCKS', 'IS_BLOCKED_BY', 'RELATES_TO', 'DUPLICATES');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "ProjectTaskLink" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "sourceTaskId" TEXT NOT NULL,
  "targetTaskId" TEXT NOT NULL,
  "type" "ProjectTaskLinkType" NOT NULL DEFAULT 'RELATES_TO',
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectTaskLink_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ProjectTaskLink_sourceTaskId_targetTaskId_type_key"
  ON "ProjectTaskLink"("sourceTaskId", "targetTaskId", "type");
CREATE INDEX IF NOT EXISTS "ProjectTaskLink_projectId_idx" ON "ProjectTaskLink"("projectId");
CREATE INDEX IF NOT EXISTS "ProjectTaskLink_sourceTaskId_idx" ON "ProjectTaskLink"("sourceTaskId");
CREATE INDEX IF NOT EXISTS "ProjectTaskLink_targetTaskId_idx" ON "ProjectTaskLink"("targetTaskId");
DO $$ BEGIN
  ALTER TABLE "ProjectTaskLink" ADD CONSTRAINT "ProjectTaskLink_sourceTaskId_fkey"
    FOREIGN KEY ("sourceTaskId") REFERENCES "ProjectTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "ProjectTaskLink" ADD CONSTRAINT "ProjectTaskLink_targetTaskId_fkey"
    FOREIGN KEY ("targetTaskId") REFERENCES "ProjectTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "ProjectTaskLink" ADD CONSTRAINT "ProjectTaskLink_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ProjectTaskWorklog
CREATE TABLE IF NOT EXISTS "ProjectTaskWorklog" (
  "id" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "hours" DOUBLE PRECISION NOT NULL,
  "note" TEXT,
  "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectTaskWorklog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ProjectTaskWorklog_taskId_idx" ON "ProjectTaskWorklog"("taskId");
CREATE INDEX IF NOT EXISTS "ProjectTaskWorklog_userId_idx" ON "ProjectTaskWorklog"("userId");
CREATE INDEX IF NOT EXISTS "ProjectTaskWorklog_loggedAt_idx" ON "ProjectTaskWorklog"("loggedAt");
DO $$ BEGIN
  ALTER TABLE "ProjectTaskWorklog" ADD CONSTRAINT "ProjectTaskWorklog_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "ProjectTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "ProjectTaskWorklog" ADD CONSTRAINT "ProjectTaskWorklog_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
