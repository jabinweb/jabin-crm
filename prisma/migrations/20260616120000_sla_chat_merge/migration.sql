-- SLA policies, live chat, ticket merge support

ALTER TABLE "SupportTicket" ADD COLUMN IF NOT EXISTS "mergedIntoId" TEXT;
CREATE INDEX IF NOT EXISTS "SupportTicket_mergedIntoId_idx" ON "SupportTicket"("mergedIntoId");
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_mergedIntoId_fkey"
  FOREIGN KEY ("mergedIntoId") REFERENCES "SupportTicket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "SlaPolicy" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "priority" "TicketPriority" NOT NULL,
  "responseHours" INTEGER NOT NULL,
  "resolutionHours" INTEGER NOT NULL,
  "isDefault" BOOLEAN NOT NULL DEFAULT true,
  "companyId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SlaPolicy_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SlaPolicy_companyId_priority_key" ON "SlaPolicy"("companyId", "priority");
CREATE INDEX IF NOT EXISTS "SlaPolicy_companyId_idx" ON "SlaPolicy"("companyId");
ALTER TABLE "SlaPolicy" ADD CONSTRAINT "SlaPolicy_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "LiveChatSession" (
  "id" TEXT NOT NULL,
  "visitorToken" TEXT NOT NULL,
  "visitorName" TEXT,
  "visitorEmail" TEXT,
  "customerId" TEXT,
  "ticketId" TEXT,
  "companyId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LiveChatSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "LiveChatSession_visitorToken_key" ON "LiveChatSession"("visitorToken");
CREATE UNIQUE INDEX IF NOT EXISTS "LiveChatSession_ticketId_key" ON "LiveChatSession"("ticketId");
CREATE INDEX IF NOT EXISTS "LiveChatSession_companyId_idx" ON "LiveChatSession"("companyId");
CREATE INDEX IF NOT EXISTS "LiveChatSession_status_idx" ON "LiveChatSession"("status");
CREATE INDEX IF NOT EXISTS "LiveChatSession_customerId_idx" ON "LiveChatSession"("customerId");

ALTER TABLE "LiveChatSession" ADD CONSTRAINT "LiveChatSession_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LiveChatSession" ADD CONSTRAINT "LiveChatSession_ticketId_fkey"
  FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LiveChatSession" ADD CONSTRAINT "LiveChatSession_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "LiveChatMessage" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "sender" TEXT NOT NULL,
  "senderId" TEXT,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LiveChatMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "LiveChatMessage_sessionId_idx" ON "LiveChatMessage"("sessionId");
CREATE INDEX IF NOT EXISTS "LiveChatMessage_createdAt_idx" ON "LiveChatMessage"("createdAt");
ALTER TABLE "LiveChatMessage" ADD CONSTRAINT "LiveChatMessage_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "LiveChatSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Default global SLA policies (one row per priority, companyId NULL)
INSERT INTO "SlaPolicy" ("id", "name", "priority", "responseHours", "resolutionHours", "isDefault", "updatedAt")
VALUES
  ('sla_default_low', 'Standard — Low', 'LOW', 8, 72, true, CURRENT_TIMESTAMP),
  ('sla_default_medium', 'Standard — Medium', 'MEDIUM', 4, 48, true, CURRENT_TIMESTAMP),
  ('sla_default_high', 'Standard — High', 'HIGH', 2, 24, true, CURRENT_TIMESTAMP),
  ('sla_default_critical', 'Standard — Critical', 'CRITICAL', 1, 8, true, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
