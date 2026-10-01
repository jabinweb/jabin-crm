-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'PROJECT_MENTION';

-- CreateTable
CREATE TABLE IF NOT EXISTS "ProjectDoc" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "parentId" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'PAGE',
    "title" TEXT NOT NULL DEFAULT 'Untitled',
    "icon" TEXT,
    "contentHtml" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectDoc_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ProjectDoc_projectId_idx" ON "ProjectDoc"("projectId");
CREATE INDEX IF NOT EXISTS "ProjectDoc_parentId_idx" ON "ProjectDoc"("parentId");
CREATE INDEX IF NOT EXISTS "ProjectDoc_projectId_parentId_sortOrder_idx" ON "ProjectDoc"("projectId", "parentId", "sortOrder");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProjectDoc_projectId_fkey') THEN
    ALTER TABLE "ProjectDoc"
      ADD CONSTRAINT "ProjectDoc_projectId_fkey"
      FOREIGN KEY ("projectId") REFERENCES "Project"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProjectDoc_parentId_fkey') THEN
    ALTER TABLE "ProjectDoc"
      ADD CONSTRAINT "ProjectDoc_parentId_fkey"
      FOREIGN KEY ("parentId") REFERENCES "ProjectDoc"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProjectDoc_createdById_fkey') THEN
    ALTER TABLE "ProjectDoc"
      ADD CONSTRAINT "ProjectDoc_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProjectDoc_updatedById_fkey') THEN
    ALTER TABLE "ProjectDoc"
      ADD CONSTRAINT "ProjectDoc_updatedById_fkey"
      FOREIGN KEY ("updatedById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "ProjectDocPresence" (
    "docId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectDocPresence_pkey" PRIMARY KEY ("docId", "userId")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ProjectDocPresence_lastSeenAt_idx" ON "ProjectDocPresence"("lastSeenAt");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProjectDocPresence_docId_fkey') THEN
    ALTER TABLE "ProjectDocPresence"
      ADD CONSTRAINT "ProjectDocPresence_docId_fkey"
      FOREIGN KEY ("docId") REFERENCES "ProjectDoc"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProjectDocPresence_userId_fkey') THEN
    ALTER TABLE "ProjectDocPresence"
      ADD CONSTRAINT "ProjectDocPresence_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
