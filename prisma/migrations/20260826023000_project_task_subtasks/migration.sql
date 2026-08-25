-- AlterTable
ALTER TABLE "ProjectTask" ADD COLUMN IF NOT EXISTS "parentTaskId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ProjectTask_parentTaskId_idx" ON "ProjectTask"("parentTaskId");
CREATE INDEX IF NOT EXISTS "ProjectTask_projectId_parentTaskId_idx" ON "ProjectTask"("projectId", "parentTaskId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "ProjectTask" ADD CONSTRAINT "ProjectTask_parentTaskId_fkey"
    FOREIGN KEY ("parentTaskId") REFERENCES "ProjectTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
