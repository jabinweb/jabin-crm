-- Remove Jira fields (product decision: no Jira integration)
ALTER TABLE "SupportTicket" DROP COLUMN IF EXISTS "jiraIssueKey";
ALTER TABLE "SupportTicket" DROP COLUMN IF EXISTS "jiraIssueUrl";
ALTER TABLE "RoadmapItem" DROP COLUMN IF EXISTS "jiraKey";
