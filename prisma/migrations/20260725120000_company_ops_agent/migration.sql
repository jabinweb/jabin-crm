-- CreateTable
CREATE TABLE IF NOT EXISTS "CompanyAgent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Ops Agent',
    "preferredModel" TEXT,
    "fallbackModels" JSONB NOT NULL DEFAULT '[]',
    "systemPromptExtra" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyAgent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AgentThread" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AgentMessage" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AgentToolRun" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "toolName" TEXT NOT NULL,
    "args" JSONB NOT NULL,
    "result" JSONB,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "executedAt" TIMESTAMP(3),

    CONSTRAINT "AgentToolRun_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CompanyAgent_companyId_key" ON "CompanyAgent"("companyId");
CREATE INDEX IF NOT EXISTS "CompanyAgent_companyId_idx" ON "CompanyAgent"("companyId");
CREATE INDEX IF NOT EXISTS "AgentThread_companyId_idx" ON "AgentThread"("companyId");
CREATE INDEX IF NOT EXISTS "AgentThread_agentId_idx" ON "AgentThread"("agentId");
CREATE INDEX IF NOT EXISTS "AgentThread_userId_idx" ON "AgentThread"("userId");
CREATE INDEX IF NOT EXISTS "AgentThread_updatedAt_idx" ON "AgentThread"("updatedAt");
CREATE INDEX IF NOT EXISTS "AgentMessage_threadId_idx" ON "AgentMessage"("threadId");
CREATE INDEX IF NOT EXISTS "AgentMessage_createdAt_idx" ON "AgentMessage"("createdAt");
CREATE INDEX IF NOT EXISTS "AgentToolRun_threadId_idx" ON "AgentToolRun"("threadId");
CREATE INDEX IF NOT EXISTS "AgentToolRun_status_idx" ON "AgentToolRun"("status");

DO $$ BEGIN
  ALTER TABLE "CompanyAgent" ADD CONSTRAINT "CompanyAgent_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "AgentThread" ADD CONSTRAINT "AgentThread_agentId_fkey"
    FOREIGN KEY ("agentId") REFERENCES "CompanyAgent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "AgentMessage" ADD CONSTRAINT "AgentMessage_threadId_fkey"
    FOREIGN KEY ("threadId") REFERENCES "AgentThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "AgentToolRun" ADD CONSTRAINT "AgentToolRun_threadId_fkey"
    FOREIGN KEY ("threadId") REFERENCES "AgentThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
