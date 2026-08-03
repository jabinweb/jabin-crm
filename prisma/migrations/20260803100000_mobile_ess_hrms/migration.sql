-- Mobile ESS: leave policies/balances, holidays, employee profile fields

ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "dateOfBirth" TIMESTAMP(3);
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "gender" TEXT;
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "emergencyContact" JSONB;

ALTER TABLE "LeaveRequest" ADD COLUMN IF NOT EXISTS "policyId" TEXT;
ALTER TABLE "LeaveRequest" ADD COLUMN IF NOT EXISTS "days" DOUBLE PRECISION NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS "LeavePolicy" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "daysPerYear" DOUBLE PRECISION NOT NULL DEFAULT 12,
  "carryForwardMax" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "isPaid" BOOLEAN NOT NULL DEFAULT true,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LeavePolicy_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "LeavePolicy_companyId_code_key" ON "LeavePolicy"("companyId", "code");
CREATE INDEX IF NOT EXISTS "LeavePolicy_companyId_idx" ON "LeavePolicy"("companyId");

CREATE TABLE IF NOT EXISTS "LeaveBalance" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "policyId" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "entitled" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "used" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "pending" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LeaveBalance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "LeaveBalance_employeeId_policyId_year_key" ON "LeaveBalance"("employeeId", "policyId", "year");
CREATE INDEX IF NOT EXISTS "LeaveBalance_employeeId_idx" ON "LeaveBalance"("employeeId");
CREATE INDEX IF NOT EXISTS "LeaveBalance_policyId_idx" ON "LeaveBalance"("policyId");
CREATE INDEX IF NOT EXISTS "LeaveBalance_year_idx" ON "LeaveBalance"("year");

CREATE TABLE IF NOT EXISTS "CompanyHoliday" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'PUBLIC',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CompanyHoliday_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CompanyHoliday_companyId_idx" ON "CompanyHoliday"("companyId");
CREATE INDEX IF NOT EXISTS "CompanyHoliday_date_idx" ON "CompanyHoliday"("date");
CREATE UNIQUE INDEX IF NOT EXISTS "CompanyHoliday_companyId_date_name_key" ON "CompanyHoliday"("companyId", "date", "name");

CREATE INDEX IF NOT EXISTS "LeaveRequest_policyId_idx" ON "LeaveRequest"("policyId");

DO $$ BEGIN
  ALTER TABLE "LeavePolicy" ADD CONSTRAINT "LeavePolicy_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "LeaveBalance" ADD CONSTRAINT "LeaveBalance_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "LeaveBalance" ADD CONSTRAINT "LeaveBalance_policyId_fkey"
    FOREIGN KEY ("policyId") REFERENCES "LeavePolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CompanyHoliday" ADD CONSTRAINT "CompanyHoliday_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_policyId_fkey"
    FOREIGN KEY ("policyId") REFERENCES "LeavePolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
