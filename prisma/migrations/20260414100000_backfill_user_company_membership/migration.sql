-- Backfill UserCompany from legacy User.companyId / User.primaryCompanyId.
-- This makes join tables the source of truth while we keep legacy fields as caches.

INSERT INTO "UserCompany" ("id", "userId", "companyId")
SELECT
  gen_random_uuid()::text,
  u."id",
  u."companyId"
FROM "User" u
WHERE u."companyId" IS NOT NULL
ON CONFLICT ("userId", "companyId") DO NOTHING;

INSERT INTO "UserCompany" ("id", "userId", "companyId")
SELECT
  gen_random_uuid()::text,
  u."id",
  u."primaryCompanyId"
FROM "User" u
WHERE u."primaryCompanyId" IS NOT NULL
ON CONFLICT ("userId", "companyId") DO NOTHING;

-- Ensure primaryCompanyId points to a membership.
-- If a user has no primaryCompanyId but has companyId, set primaryCompanyId = companyId.
UPDATE "User" u
SET "primaryCompanyId" = u."companyId"
WHERE u."primaryCompanyId" IS NULL
  AND u."companyId" IS NOT NULL;

-- Backfill UserCompanyRole where we can determine assignedById.
-- We use Company.adminId (Employee) as the assigner when present; otherwise we skip.
-- Role mapping is best-effort:
--   SUPER_ADMIN -> SUPER_ADMIN
--   ADMIN -> ADMIN
--   SUPPORT_MANAGER -> MANAGER
--   TECHNICIAN -> EMPLOYEE
--   SALES/CUSTOMER -> USER
INSERT INTO "UserCompanyRole" ("id", "userId", "companyId", "role", "assignedById", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  u."id",
  COALESCE(u."primaryCompanyId", u."companyId") AS "companyId",
  CASE u."role"::text
    WHEN 'SUPER_ADMIN' THEN 'SUPER_ADMIN'::"CompanyRole"
    WHEN 'ADMIN' THEN 'ADMIN'::"CompanyRole"
    WHEN 'SUPPORT_MANAGER' THEN 'MANAGER'::"CompanyRole"
    WHEN 'TECHNICIAN' THEN 'EMPLOYEE'::"CompanyRole"
    ELSE 'USER'::"CompanyRole"
  END AS "role",
  c."adminId" AS "assignedById",
  NOW(),
  NOW()
FROM "User" u
JOIN "Company" c
  ON c."id" = COALESCE(u."primaryCompanyId", u."companyId")
WHERE COALESCE(u."primaryCompanyId", u."companyId") IS NOT NULL
  AND c."adminId" IS NOT NULL
ON CONFLICT ("userId", "companyId") DO NOTHING;

-- Index (plan requested). These may already exist; create if missing.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = current_schema()
      AND indexname = 'UserCompanyRole_userId_companyId_idx'
  ) THEN
    CREATE INDEX "UserCompanyRole_userId_companyId_idx" ON "UserCompanyRole" ("userId", "companyId");
  END IF;
END $$;

