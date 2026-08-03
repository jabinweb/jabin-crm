-- Service Ops Gap MVPs: signing, dispatch, analytics timestamps, project/budget/asset links

ALTER TABLE "SupportTicket" ADD COLUMN IF NOT EXISTS "firstRespondedAt" TIMESTAMP(3);
ALTER TABLE "SupportTicket" ADD COLUMN IF NOT EXISTS "resolvedAt" TIMESTAMP(3);
ALTER TABLE "SupportTicket" ADD COLUMN IF NOT EXISTS "scheduledFor" TIMESTAMP(3);
ALTER TABLE "SupportTicket" ADD COLUMN IF NOT EXISTS "estimatedDurationMin" INTEGER;

CREATE INDEX IF NOT EXISTS "SupportTicket_scheduledFor_idx" ON "SupportTicket"("scheduledFor");
CREATE INDEX IF NOT EXISTS "SupportTicket_resolvedAt_idx" ON "SupportTicket"("resolvedAt");

ALTER TABLE "ServiceReport" ADD COLUMN IF NOT EXISTS "customerSignerName" TEXT;
ALTER TABLE "ServiceReport" ADD COLUMN IF NOT EXISTS "signedAt" TIMESTAMP(3);
ALTER TABLE "ServiceReport" ADD COLUMN IF NOT EXISTS "signatureDataUrl" TEXT;

ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "customerId" TEXT;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "dealId" TEXT;

CREATE INDEX IF NOT EXISTS "Project_customerId_idx" ON "Project"("customerId");
CREATE INDEX IF NOT EXISTS "Project_dealId_idx" ON "Project"("dealId");

ALTER TABLE "Budget" ADD COLUMN IF NOT EXISTS "projectId" TEXT;
CREATE INDEX IF NOT EXISTS "Budget_projectId_idx" ON "Budget"("projectId");

ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "equipmentInstallationId" TEXT;
CREATE INDEX IF NOT EXISTS "Asset_equipmentInstallationId_idx" ON "Asset"("equipmentInstallationId");

DO $$ BEGIN
  ALTER TABLE "Project" ADD CONSTRAINT "Project_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Project" ADD CONSTRAINT "Project_dealId_fkey"
    FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Budget" ADD CONSTRAINT "Budget_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Asset" ADD CONSTRAINT "Asset_equipmentInstallationId_fkey"
    FOREIGN KEY ("equipmentInstallationId") REFERENCES "EquipmentInstallation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
