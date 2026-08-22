-- dbcrm support parity: watchers, saved filters, custom fields, guest token, jira, community, roadmap

ALTER TABLE "SupportTicket" ADD COLUMN IF NOT EXISTS "guestAccessToken" TEXT;
ALTER TABLE "SupportTicket" ADD COLUMN IF NOT EXISTS "jiraIssueKey" TEXT;
ALTER TABLE "SupportTicket" ADD COLUMN IF NOT EXISTS "jiraIssueUrl" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "SupportTicket_guestAccessToken_key" ON "SupportTicket"("guestAccessToken");
CREATE INDEX IF NOT EXISTS "SupportTicket_guestAccessToken_idx" ON "SupportTicket"("guestAccessToken");

CREATE TABLE IF NOT EXISTS "TicketWatcher" (
  "id" TEXT NOT NULL,
  "ticketId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TicketWatcher_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "TicketWatcher_ticketId_userId_key" ON "TicketWatcher"("ticketId", "userId");
CREATE INDEX IF NOT EXISTS "TicketWatcher_ticketId_idx" ON "TicketWatcher"("ticketId");
CREATE INDEX IF NOT EXISTS "TicketWatcher_userId_idx" ON "TicketWatcher"("userId");
DO $$ BEGIN
  ALTER TABLE "TicketWatcher" ADD CONSTRAINT "TicketWatcher_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "TicketWatcher" ADD CONSTRAINT "TicketWatcher_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "SavedTicketFilter" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "filters" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SavedTicketFilter_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "SavedTicketFilter_userId_name_key" ON "SavedTicketFilter"("userId", "name");
CREATE INDEX IF NOT EXISTS "SavedTicketFilter_companyId_idx" ON "SavedTicketFilter"("companyId");
CREATE INDEX IF NOT EXISTS "SavedTicketFilter_userId_idx" ON "SavedTicketFilter"("userId");
DO $$ BEGIN
  ALTER TABLE "SavedTicketFilter" ADD CONSTRAINT "SavedTicketFilter_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "SavedTicketFilter" ADD CONSTRAINT "SavedTicketFilter_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "TicketCustomFieldDef" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "fieldType" TEXT NOT NULL DEFAULT 'text',
  "options" JSONB,
  "required" BOOLEAN NOT NULL DEFAULT false,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TicketCustomFieldDef_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "TicketCustomFieldDef_companyId_key_key" ON "TicketCustomFieldDef"("companyId", "key");
CREATE INDEX IF NOT EXISTS "TicketCustomFieldDef_companyId_idx" ON "TicketCustomFieldDef"("companyId");
DO $$ BEGIN
  ALTER TABLE "TicketCustomFieldDef" ADD CONSTRAINT "TicketCustomFieldDef_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "CommunityPost" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "authorId" TEXT,
  "authorName" TEXT,
  "category" TEXT NOT NULL DEFAULT 'general',
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "pinned" BOOLEAN NOT NULL DEFAULT false,
  "hidden" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CommunityPost_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "CommunityPost_companyId_idx" ON "CommunityPost"("companyId");
CREATE INDEX IF NOT EXISTS "CommunityPost_category_idx" ON "CommunityPost"("category");
CREATE INDEX IF NOT EXISTS "CommunityPost_createdAt_idx" ON "CommunityPost"("createdAt");
DO $$ BEGIN
  ALTER TABLE "CommunityPost" ADD CONSTRAINT "CommunityPost_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "CommunityReply" (
  "id" TEXT NOT NULL,
  "postId" TEXT NOT NULL,
  "parentId" TEXT,
  "authorId" TEXT,
  "authorName" TEXT,
  "body" TEXT NOT NULL,
  "hidden" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CommunityReply_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "CommunityReply_postId_idx" ON "CommunityReply"("postId");
CREATE INDEX IF NOT EXISTS "CommunityReply_parentId_idx" ON "CommunityReply"("parentId");
DO $$ BEGIN
  ALTER TABLE "CommunityReply" ADD CONSTRAINT "CommunityReply_postId_fkey" FOREIGN KEY ("postId") REFERENCES "CommunityPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "CommunityReply" ADD CONSTRAINT "CommunityReply_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "CommunityReply"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "CommunityReaction" (
  "id" TEXT NOT NULL,
  "postId" TEXT,
  "replyId" TEXT,
  "emoji" TEXT NOT NULL,
  "voterKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommunityReaction_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CommunityReaction_postId_emoji_voterKey_key" ON "CommunityReaction"("postId", "emoji", "voterKey");
CREATE UNIQUE INDEX IF NOT EXISTS "CommunityReaction_replyId_emoji_voterKey_key" ON "CommunityReaction"("replyId", "emoji", "voterKey");
CREATE INDEX IF NOT EXISTS "CommunityReaction_postId_idx" ON "CommunityReaction"("postId");
CREATE INDEX IF NOT EXISTS "CommunityReaction_replyId_idx" ON "CommunityReaction"("replyId");
DO $$ BEGIN
  ALTER TABLE "CommunityReaction" ADD CONSTRAINT "CommunityReaction_postId_fkey" FOREIGN KEY ("postId") REFERENCES "CommunityPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "CommunityReaction" ADD CONSTRAINT "CommunityReaction_replyId_fkey" FOREIGN KEY ("replyId") REFERENCES "CommunityReply"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "RoadmapItem" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" TEXT NOT NULL DEFAULT 'considering',
  "published" BOOLEAN NOT NULL DEFAULT true,
  "jiraKey" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RoadmapItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "RoadmapItem_companyId_idx" ON "RoadmapItem"("companyId");
CREATE INDEX IF NOT EXISTS "RoadmapItem_status_idx" ON "RoadmapItem"("status");
CREATE INDEX IF NOT EXISTS "RoadmapItem_published_idx" ON "RoadmapItem"("published");
DO $$ BEGIN
  ALTER TABLE "RoadmapItem" ADD CONSTRAINT "RoadmapItem_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "RoadmapVote" (
  "id" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "voterKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RoadmapVote_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "RoadmapVote_itemId_voterKey_key" ON "RoadmapVote"("itemId", "voterKey");
CREATE INDEX IF NOT EXISTS "RoadmapVote_itemId_idx" ON "RoadmapVote"("itemId");
DO $$ BEGIN
  ALTER TABLE "RoadmapVote" ADD CONSTRAINT "RoadmapVote_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "RoadmapItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
