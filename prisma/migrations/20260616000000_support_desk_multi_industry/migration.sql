-- Multi-industry support desk foundation

-- Customer: industry segmentation + tenant link (organizationName maps to existing hospitalName column via Prisma)
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "industry" TEXT;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "accountType" TEXT;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "companyId" TEXT;

CREATE INDEX IF NOT EXISTS "Customer_industry_idx" ON "Customer"("industry");
CREATE INDEX IF NOT EXISTS "Customer_companyId_idx" ON "Customer"("companyId");

DO $$ BEGIN
  ALTER TABLE "Customer" ADD CONSTRAINT "Customer_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Ticket channel, tags, groups, CSAT
CREATE TYPE "TicketChannel" AS ENUM ('EMAIL', 'PORTAL', 'PHONE', 'WHATSAPP', 'CHAT', 'API');

ALTER TABLE "SupportTicket" ADD COLUMN IF NOT EXISTS "groupId" TEXT;
ALTER TABLE "SupportTicket" ADD COLUMN IF NOT EXISTS "channel" "TicketChannel" NOT NULL DEFAULT 'PORTAL';
ALTER TABLE "SupportTicket" ADD COLUMN IF NOT EXISTS "ticketType" TEXT;
ALTER TABLE "SupportTicket" ADD COLUMN IF NOT EXISTS "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "SupportTicket" ADD COLUMN IF NOT EXISTS "csatRating" INTEGER;
ALTER TABLE "SupportTicket" ADD COLUMN IF NOT EXISTS "csatComment" TEXT;
ALTER TABLE "SupportTicket" ADD COLUMN IF NOT EXISTS "csatSubmittedAt" TIMESTAMP(3);

ALTER TABLE "TicketActivity" ADD COLUMN IF NOT EXISTS "isInternal" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "SupportTicket_groupId_idx" ON "SupportTicket"("groupId");
CREATE INDEX IF NOT EXISTS "SupportTicket_channel_idx" ON "SupportTicket"("channel");
CREATE INDEX IF NOT EXISTS "TicketActivity_isInternal_idx" ON "TicketActivity"("isInternal");

CREATE TABLE IF NOT EXISTS "SupportGroup" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "email" TEXT,
  "companyId" TEXT,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SupportGroup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SupportGroupMember" (
  "id" TEXT NOT NULL,
  "groupId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupportGroupMember_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SupportGroupMember_groupId_userId_key" ON "SupportGroupMember"("groupId", "userId");
CREATE INDEX IF NOT EXISTS "SupportGroupMember_userId_idx" ON "SupportGroupMember"("userId");
CREATE INDEX IF NOT EXISTS "SupportGroup_companyId_idx" ON "SupportGroup"("companyId");

CREATE TABLE IF NOT EXISTS "SupportCannedResponse" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "category" TEXT,
  "isShared" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT,
  "companyId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SupportCannedResponse_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SupportCannedResponse_companyId_idx" ON "SupportCannedResponse"("companyId");
CREATE INDEX IF NOT EXISTS "SupportCannedResponse_category_idx" ON "SupportCannedResponse"("category");

CREATE TABLE IF NOT EXISTS "KnowledgeArticle" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "category" TEXT,
  "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "published" BOOLEAN NOT NULL DEFAULT false,
  "viewCount" INTEGER NOT NULL DEFAULT 0,
  "helpfulCount" INTEGER NOT NULL DEFAULT 0,
  "companyId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "KnowledgeArticle_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "KnowledgeArticle_slug_key" ON "KnowledgeArticle"("slug");
CREATE INDEX IF NOT EXISTS "KnowledgeArticle_companyId_idx" ON "KnowledgeArticle"("companyId");
CREATE INDEX IF NOT EXISTS "KnowledgeArticle_category_idx" ON "KnowledgeArticle"("category");
CREATE INDEX IF NOT EXISTS "KnowledgeArticle_published_idx" ON "KnowledgeArticle"("published");

DO $$ BEGIN
  ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_groupId_fkey"
    FOREIGN KEY ("groupId") REFERENCES "SupportGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "SupportGroup" ADD CONSTRAINT "SupportGroup_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "SupportGroupMember" ADD CONSTRAINT "SupportGroupMember_groupId_fkey"
    FOREIGN KEY ("groupId") REFERENCES "SupportGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "SupportGroupMember" ADD CONSTRAINT "SupportGroupMember_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "SupportCannedResponse" ADD CONSTRAINT "SupportCannedResponse_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "KnowledgeArticle" ADD CONSTRAINT "KnowledgeArticle_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
