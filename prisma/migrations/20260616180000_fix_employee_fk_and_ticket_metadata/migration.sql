-- Fix duplicate Employee.userId FK and add SupportTicket metadata/SLA columns

-- Erroneous second FK on Employee.userId (manager relation reused login userId)
ALTER TABLE "Employee" DROP CONSTRAINT IF EXISTS "Employee_manager_fkey";

-- Universal support desk: queryable custom fields + SLA due dates on tickets
ALTER TABLE "SupportTicket" ADD COLUMN IF NOT EXISTS "metadata" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "SupportTicket" ADD COLUMN IF NOT EXISTS "responseDueAt" TIMESTAMP(3);
ALTER TABLE "SupportTicket" ADD COLUMN IF NOT EXISTS "resolutionDueAt" TIMESTAMP(3);
