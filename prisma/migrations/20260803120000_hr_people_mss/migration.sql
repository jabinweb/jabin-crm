-- AlterTable
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "departmentId" TEXT;
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "designationId" TEXT;
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "branchId" TEXT;
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "customFields" JSONB;

-- CreateTable
CREATE TABLE IF NOT EXISTS "HrDepartment" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "parentId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "HrDepartment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "HrDesignation" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "level" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "HrDesignation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "HrBranch" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "address" TEXT,
    "city" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "HrBranch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "EmployeeDocument" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'GENERAL',
    "fileUrl" TEXT NOT NULL,
    "mimeType" TEXT,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EmployeeDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "EmployeeSkill" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" TEXT,
    "certifiedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EmployeeSkill_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "EmployeeDependent" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "relation" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EmployeeDependent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "EmployeeActivity" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "actorId" TEXT,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmployeeActivity_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX IF NOT EXISTS "HrDepartment_companyId_idx" ON "HrDepartment"("companyId");
CREATE INDEX IF NOT EXISTS "HrDepartment_parentId_idx" ON "HrDepartment"("parentId");
CREATE UNIQUE INDEX IF NOT EXISTS "HrDepartment_companyId_name_key" ON "HrDepartment"("companyId", "name");

CREATE INDEX IF NOT EXISTS "HrDesignation_companyId_idx" ON "HrDesignation"("companyId");
CREATE UNIQUE INDEX IF NOT EXISTS "HrDesignation_companyId_name_key" ON "HrDesignation"("companyId", "name");

CREATE INDEX IF NOT EXISTS "HrBranch_companyId_idx" ON "HrBranch"("companyId");
CREATE UNIQUE INDEX IF NOT EXISTS "HrBranch_companyId_name_key" ON "HrBranch"("companyId", "name");

CREATE INDEX IF NOT EXISTS "EmployeeDocument_employeeId_idx" ON "EmployeeDocument"("employeeId");
CREATE INDEX IF NOT EXISTS "EmployeeDocument_uploadedById_idx" ON "EmployeeDocument"("uploadedById");

CREATE INDEX IF NOT EXISTS "EmployeeSkill_employeeId_idx" ON "EmployeeSkill"("employeeId");
CREATE INDEX IF NOT EXISTS "EmployeeDependent_employeeId_idx" ON "EmployeeDependent"("employeeId");
CREATE INDEX IF NOT EXISTS "EmployeeActivity_employeeId_idx" ON "EmployeeActivity"("employeeId");
CREATE INDEX IF NOT EXISTS "EmployeeActivity_actorId_idx" ON "EmployeeActivity"("actorId");
CREATE INDEX IF NOT EXISTS "EmployeeActivity_createdAt_idx" ON "EmployeeActivity"("createdAt");

CREATE INDEX IF NOT EXISTS "Employee_departmentId_idx" ON "Employee"("departmentId");
CREATE INDEX IF NOT EXISTS "Employee_designationId_idx" ON "Employee"("designationId");
CREATE INDEX IF NOT EXISTS "Employee_branchId_idx" ON "Employee"("branchId");

-- FKs
ALTER TABLE "HrDepartment" DROP CONSTRAINT IF EXISTS "HrDepartment_companyId_fkey";
ALTER TABLE "HrDepartment" ADD CONSTRAINT "HrDepartment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HrDepartment" DROP CONSTRAINT IF EXISTS "HrDepartment_parentId_fkey";
ALTER TABLE "HrDepartment" ADD CONSTRAINT "HrDepartment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "HrDepartment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "HrDesignation" DROP CONSTRAINT IF EXISTS "HrDesignation_companyId_fkey";
ALTER TABLE "HrDesignation" ADD CONSTRAINT "HrDesignation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HrBranch" DROP CONSTRAINT IF EXISTS "HrBranch_companyId_fkey";
ALTER TABLE "HrBranch" ADD CONSTRAINT "HrBranch_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Employee" DROP CONSTRAINT IF EXISTS "Employee_departmentId_fkey";
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "HrDepartment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Employee" DROP CONSTRAINT IF EXISTS "Employee_designationId_fkey";
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_designationId_fkey" FOREIGN KEY ("designationId") REFERENCES "HrDesignation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Employee" DROP CONSTRAINT IF EXISTS "Employee_branchId_fkey";
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "HrBranch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EmployeeDocument" DROP CONSTRAINT IF EXISTS "EmployeeDocument_employeeId_fkey";
ALTER TABLE "EmployeeDocument" ADD CONSTRAINT "EmployeeDocument_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployeeDocument" DROP CONSTRAINT IF EXISTS "EmployeeDocument_uploadedById_fkey";
ALTER TABLE "EmployeeDocument" ADD CONSTRAINT "EmployeeDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EmployeeSkill" DROP CONSTRAINT IF EXISTS "EmployeeSkill_employeeId_fkey";
ALTER TABLE "EmployeeSkill" ADD CONSTRAINT "EmployeeSkill_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmployeeDependent" DROP CONSTRAINT IF EXISTS "EmployeeDependent_employeeId_fkey";
ALTER TABLE "EmployeeDependent" ADD CONSTRAINT "EmployeeDependent_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmployeeActivity" DROP CONSTRAINT IF EXISTS "EmployeeActivity_employeeId_fkey";
ALTER TABLE "EmployeeActivity" ADD CONSTRAINT "EmployeeActivity_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployeeActivity" DROP CONSTRAINT IF EXISTS "EmployeeActivity_actorId_fkey";
ALTER TABLE "EmployeeActivity" ADD CONSTRAINT "EmployeeActivity_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
