-- Project delivery tasks (Kanban / list board)

CREATE TABLE IF NOT EXISTS "ProjectTask" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" TEXT NOT NULL DEFAULT 'TODO',
  "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
  "assigneeId" TEXT,
  "dueDate" TIMESTAMP(3),
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProjectTask_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ProjectTask_projectId_idx" ON "ProjectTask"("projectId");
CREATE INDEX IF NOT EXISTS "ProjectTask_status_idx" ON "ProjectTask"("status");
CREATE INDEX IF NOT EXISTS "ProjectTask_assigneeId_idx" ON "ProjectTask"("assigneeId");
CREATE INDEX IF NOT EXISTS "ProjectTask_dueDate_idx" ON "ProjectTask"("dueDate");
CREATE INDEX IF NOT EXISTS "ProjectTask_projectId_status_sortOrder_idx" ON "ProjectTask"("projectId", "status", "sortOrder");

DO $$ BEGIN
  ALTER TABLE "ProjectTask" ADD CONSTRAINT "ProjectTask_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ProjectTask" ADD CONSTRAINT "ProjectTask_assigneeId_fkey"
    FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
