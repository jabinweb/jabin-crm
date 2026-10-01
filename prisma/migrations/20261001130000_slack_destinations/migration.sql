-- CreateTable
CREATE TABLE IF NOT EXISTS "SlackDestination" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "webhookUrl" TEXT NOT NULL,
    "events" TEXT[],
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastDeliveredAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SlackDestination_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SlackDestination_companyId_userId_idx" ON "SlackDestination"("companyId", "userId");
CREATE INDEX IF NOT EXISTS "SlackDestination_userId_idx" ON "SlackDestination"("userId");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SlackDestination_companyId_fkey') THEN
    ALTER TABLE "SlackDestination"
      ADD CONSTRAINT "SlackDestination_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SlackDestination_userId_fkey') THEN
    ALTER TABLE "SlackDestination"
      ADD CONSTRAINT "SlackDestination_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
