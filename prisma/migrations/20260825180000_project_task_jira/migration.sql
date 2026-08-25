-- AlterTable
ALTER TABLE "ProjectTask" ADD COLUMN IF NOT EXISTS "descriptionHtml" TEXT;
ALTER TABLE "ProjectTask" ADD COLUMN IF NOT EXISTS "reporterId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ProjectTask_reporterId_idx" ON "ProjectTask"("reporterId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "ProjectTask" ADD CONSTRAINT "ProjectTask_reporterId_fkey"
    FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "ProjectTaskComment" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProjectTaskComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ProjectTaskWatcher" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectTaskWatcher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ProjectTaskActivity" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "actorId" TEXT,
    "eventType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectTaskActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ProjectTaskAttachment" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "fileId" TEXT,
    "url" TEXT NOT NULL,
    "name" TEXT,
    "mimeType" TEXT,
    "size" INTEGER,
    "uploadedById" TEXT,
    "source" TEXT NOT NULL DEFAULT 'SIDEBAR',
    "commentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectTaskAttachment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ProjectTaskComment_taskId_idx" ON "ProjectTaskComment"("taskId");
CREATE INDEX IF NOT EXISTS "ProjectTaskComment_authorId_idx" ON "ProjectTaskComment"("authorId");
CREATE INDEX IF NOT EXISTS "ProjectTaskComment_createdAt_idx" ON "ProjectTaskComment"("createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "ProjectTaskWatcher_taskId_userId_key" ON "ProjectTaskWatcher"("taskId", "userId");
CREATE INDEX IF NOT EXISTS "ProjectTaskWatcher_taskId_idx" ON "ProjectTaskWatcher"("taskId");
CREATE INDEX IF NOT EXISTS "ProjectTaskWatcher_userId_idx" ON "ProjectTaskWatcher"("userId");

CREATE INDEX IF NOT EXISTS "ProjectTaskActivity_taskId_idx" ON "ProjectTaskActivity"("taskId");
CREATE INDEX IF NOT EXISTS "ProjectTaskActivity_createdAt_idx" ON "ProjectTaskActivity"("createdAt");
CREATE INDEX IF NOT EXISTS "ProjectTaskActivity_eventType_idx" ON "ProjectTaskActivity"("eventType");

CREATE INDEX IF NOT EXISTS "ProjectTaskAttachment_taskId_idx" ON "ProjectTaskAttachment"("taskId");
CREATE INDEX IF NOT EXISTS "ProjectTaskAttachment_commentId_idx" ON "ProjectTaskAttachment"("commentId");
CREATE INDEX IF NOT EXISTS "ProjectTaskAttachment_uploadedById_idx" ON "ProjectTaskAttachment"("uploadedById");

DO $$ BEGIN
  ALTER TABLE "ProjectTaskComment" ADD CONSTRAINT "ProjectTaskComment_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "ProjectTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ProjectTaskComment" ADD CONSTRAINT "ProjectTaskComment_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ProjectTaskWatcher" ADD CONSTRAINT "ProjectTaskWatcher_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "ProjectTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ProjectTaskWatcher" ADD CONSTRAINT "ProjectTaskWatcher_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ProjectTaskActivity" ADD CONSTRAINT "ProjectTaskActivity_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "ProjectTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ProjectTaskActivity" ADD CONSTRAINT "ProjectTaskActivity_actorId_fkey"
    FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ProjectTaskAttachment" ADD CONSTRAINT "ProjectTaskAttachment_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "ProjectTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ProjectTaskAttachment" ADD CONSTRAINT "ProjectTaskAttachment_commentId_fkey"
    FOREIGN KEY ("commentId") REFERENCES "ProjectTaskComment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ProjectTaskAttachment" ADD CONSTRAINT "ProjectTaskAttachment_uploadedById_fkey"
    FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
