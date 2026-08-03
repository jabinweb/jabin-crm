-- Enterprise HRMS India: Waves 1–6 schema

-- Attendance harden
ALTER TABLE "Attendance" ADD COLUMN IF NOT EXISTS "date" DATE;
ALTER TABLE "Attendance" ADD COLUMN IF NOT EXISTS "lateMinutes" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Attendance" ADD COLUMN IF NOT EXISTS "earlyDeparture" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Attendance" SET "date" = ("createdAt" AT TIME ZONE 'UTC')::date WHERE "date" IS NULL;

-- Deduplicate attendance keeping newest per employee/date
DELETE FROM "Attendance" a
USING "Attendance" b
WHERE a."employeeId" = b."employeeId"
  AND a."date" = b."date"
  AND a."createdAt" < b."createdAt";

ALTER TABLE "Attendance" ALTER COLUMN "date" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "Attendance_employeeId_date_key" ON "Attendance"("employeeId", "date");
CREATE INDEX IF NOT EXISTS "Attendance_date_idx" ON "Attendance"("date");

-- AttendanceCorrection relation
CREATE INDEX IF NOT EXISTS "AttendanceCorrection_attendanceId_idx" ON "AttendanceCorrection"("attendanceId");
DO $$ BEGIN
  ALTER TABLE "AttendanceCorrection"
    ADD CONSTRAINT "AttendanceCorrection_attendanceId_fkey"
    FOREIGN KEY ("attendanceId") REFERENCES "Attendance"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Payslip breakdown + unique
ALTER TABLE "Payslip" ADD COLUMN IF NOT EXISTS "breakdown" JSONB;
DELETE FROM "Payslip" a
USING "Payslip" b
WHERE a."employeeId" = b."employeeId"
  AND a."month" = b."month"
  AND a."year" = b."year"
  AND a."createdAt" < b."createdAt";
CREATE UNIQUE INDEX IF NOT EXISTS "Payslip_employeeId_month_year_key" ON "Payslip"("employeeId", "month", "year");
CREATE INDEX IF NOT EXISTS "Payslip_year_month_idx" ON "Payslip"("year", "month");

-- Asset assignment
ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "assignedToEmployeeId" TEXT;
CREATE INDEX IF NOT EXISTS "Asset_assignedToEmployeeId_idx" ON "Asset"("assignedToEmployeeId");
DO $$ BEGIN
  ALTER TABLE "Asset"
    ADD CONSTRAINT "Asset_assignedToEmployeeId_fkey"
    FOREIGN KEY ("assignedToEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Exit interview notes
ALTER TABLE "ExitRequest" ADD COLUMN IF NOT EXISTS "interviewNotes" TEXT;

-- Letters
CREATE TABLE IF NOT EXISTS "HrLetterTemplate" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'GENERAL',
  "body" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HrLetterTemplate_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "HrLetterTemplate_companyId_name_key" ON "HrLetterTemplate"("companyId", "name");
CREATE INDEX IF NOT EXISTS "HrLetterTemplate_companyId_idx" ON "HrLetterTemplate"("companyId");
DO $$ BEGIN
  ALTER TABLE "HrLetterTemplate"
    ADD CONSTRAINT "HrLetterTemplate_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "HrLetter" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "templateId" TEXT,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HrLetter_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "HrLetter_companyId_idx" ON "HrLetter"("companyId");
CREATE INDEX IF NOT EXISTS "HrLetter_employeeId_idx" ON "HrLetter"("employeeId");
CREATE INDEX IF NOT EXISTS "HrLetter_templateId_idx" ON "HrLetter"("templateId");
DO $$ BEGIN
  ALTER TABLE "HrLetter" ADD CONSTRAINT "HrLetter_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "HrLetter" ADD CONSTRAINT "HrLetter_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "HrLetter" ADD CONSTRAINT "HrLetter_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "HrLetterTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Candidate ATS fields
ALTER TABLE "Candidate" ADD COLUMN IF NOT EXISTS "referredBy" TEXT;
ALTER TABLE "Candidate" ADD COLUMN IF NOT EXISTS "talentPool" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Candidate" ADD COLUMN IF NOT EXISTS "bgvStatus" TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE "Interview" ADD COLUMN IF NOT EXISTS "scorecard" JSONB;

-- Announcement targeting
ALTER TABLE "Announcement" ADD COLUMN IF NOT EXISTS "targetDepartmentId" TEXT;
ALTER TABLE "Announcement" ADD COLUMN IF NOT EXISTS "targetBranchId" TEXT;
ALTER TABLE "Announcement" ADD COLUMN IF NOT EXISTS "poll" JSONB;
CREATE INDEX IF NOT EXISTS "Announcement_targetDepartmentId_idx" ON "Announcement"("targetDepartmentId");
CREATE INDEX IF NOT EXISTS "Announcement_targetBranchId_idx" ON "Announcement"("targetBranchId");

-- Expense claims
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "employeeId" TEXT;
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "category" TEXT NOT NULL DEFAULT 'GENERAL';
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'RECORDED';
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "receiptUrl" TEXT;
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "reimbursable" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "actionById" TEXT;
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "actionAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "Expense_employeeId_idx" ON "Expense"("employeeId");
CREATE INDEX IF NOT EXISTS "Expense_status_idx" ON "Expense"("status");
CREATE INDEX IF NOT EXISTS "Expense_actionById_idx" ON "Expense"("actionById");
DO $$ BEGIN
  ALTER TABLE "Expense" ADD CONSTRAINT "Expense_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "Expense" ADD CONSTRAINT "Expense_actionById_fkey" FOREIGN KEY ("actionById") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Travel
CREATE TABLE IF NOT EXISTS "TravelRequest" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "fromDate" TIMESTAMP(3) NOT NULL,
  "toDate" TIMESTAMP(3) NOT NULL,
  "estimate" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "actionById" TEXT,
  "actionAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TravelRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "TravelRequest_companyId_idx" ON "TravelRequest"("companyId");
CREATE INDEX IF NOT EXISTS "TravelRequest_employeeId_idx" ON "TravelRequest"("employeeId");
CREATE INDEX IF NOT EXISTS "TravelRequest_status_idx" ON "TravelRequest"("status");
CREATE INDEX IF NOT EXISTS "TravelRequest_actionById_idx" ON "TravelRequest"("actionById");
DO $$ BEGIN
  ALTER TABLE "TravelRequest" ADD CONSTRAINT "TravelRequest_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "TravelRequest" ADD CONSTRAINT "TravelRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "TravelRequest" ADD CONSTRAINT "TravelRequest_actionById_fkey" FOREIGN KEY ("actionById") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Timesheets
CREATE TABLE IF NOT EXISTS "Timesheet" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "weekStart" DATE NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "actionById" TEXT,
  "actionAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Timesheet_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Timesheet_employeeId_weekStart_key" ON "Timesheet"("employeeId", "weekStart");
CREATE INDEX IF NOT EXISTS "Timesheet_employeeId_idx" ON "Timesheet"("employeeId");
CREATE INDEX IF NOT EXISTS "Timesheet_status_idx" ON "Timesheet"("status");
CREATE INDEX IF NOT EXISTS "Timesheet_actionById_idx" ON "Timesheet"("actionById");
DO $$ BEGIN
  ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_actionById_fkey" FOREIGN KEY ("actionById") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "TimesheetEntry" (
  "id" TEXT NOT NULL,
  "timesheetId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "hours" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "projectId" TEXT,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TimesheetEntry_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "TimesheetEntry_timesheetId_idx" ON "TimesheetEntry"("timesheetId");
CREATE INDEX IF NOT EXISTS "TimesheetEntry_date_idx" ON "TimesheetEntry"("date");
DO $$ BEGIN
  ALTER TABLE "TimesheetEntry" ADD CONSTRAINT "TimesheetEntry_timesheetId_fkey" FOREIGN KEY ("timesheetId") REFERENCES "Timesheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Performance
CREATE TABLE IF NOT EXISTS "PerformanceCycle" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PerformanceCycle_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PerformanceCycle_companyId_idx" ON "PerformanceCycle"("companyId");
CREATE INDEX IF NOT EXISTS "PerformanceCycle_status_idx" ON "PerformanceCycle"("status");
DO $$ BEGIN
  ALTER TABLE "PerformanceCycle" ADD CONSTRAINT "PerformanceCycle_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "PerformanceGoal" (
  "id" TEXT NOT NULL,
  "cycleId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PerformanceGoal_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PerformanceGoal_cycleId_idx" ON "PerformanceGoal"("cycleId");
CREATE INDEX IF NOT EXISTS "PerformanceGoal_employeeId_idx" ON "PerformanceGoal"("employeeId");
DO $$ BEGIN
  ALTER TABLE "PerformanceGoal" ADD CONSTRAINT "PerformanceGoal_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "PerformanceCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "PerformanceGoal" ADD CONSTRAINT "PerformanceGoal_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "PerformanceReview" (
  "id" TEXT NOT NULL,
  "cycleId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "managerId" TEXT,
  "selfScore" DOUBLE PRECISION,
  "managerScore" DOUBLE PRECISION,
  "selfNotes" TEXT,
  "managerNotes" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PerformanceReview_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PerformanceReview_cycleId_employeeId_key" ON "PerformanceReview"("cycleId", "employeeId");
CREATE INDEX IF NOT EXISTS "PerformanceReview_cycleId_idx" ON "PerformanceReview"("cycleId");
CREATE INDEX IF NOT EXISTS "PerformanceReview_employeeId_idx" ON "PerformanceReview"("employeeId");
CREATE INDEX IF NOT EXISTS "PerformanceReview_managerId_idx" ON "PerformanceReview"("managerId");
DO $$ BEGIN
  ALTER TABLE "PerformanceReview" ADD CONSTRAINT "PerformanceReview_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "PerformanceCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "PerformanceReview" ADD CONSTRAINT "PerformanceReview_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "PerformanceReview" ADD CONSTRAINT "PerformanceReview_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- HR helpdesk + policy library
CREATE TABLE IF NOT EXISTS "HrTicket" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "assigneeId" TEXT,
  "category" TEXT NOT NULL DEFAULT 'GENERAL',
  "subject" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HrTicket_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "HrTicket_companyId_idx" ON "HrTicket"("companyId");
CREATE INDEX IF NOT EXISTS "HrTicket_employeeId_idx" ON "HrTicket"("employeeId");
CREATE INDEX IF NOT EXISTS "HrTicket_assigneeId_idx" ON "HrTicket"("assigneeId");
CREATE INDEX IF NOT EXISTS "HrTicket_status_idx" ON "HrTicket"("status");
DO $$ BEGIN
  ALTER TABLE "HrTicket" ADD CONSTRAINT "HrTicket_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "HrTicket" ADD CONSTRAINT "HrTicket_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "HrTicket" ADD CONSTRAINT "HrTicket_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "HrPolicyDoc" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "fileUrl" TEXT NOT NULL,
  "category" TEXT NOT NULL DEFAULT 'HANDBOOK',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HrPolicyDoc_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "HrPolicyDoc_companyId_idx" ON "HrPolicyDoc"("companyId");
DO $$ BEGIN
  ALTER TABLE "HrPolicyDoc" ADD CONSTRAINT "HrPolicyDoc_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
