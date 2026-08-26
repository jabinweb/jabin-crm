-- Notification feed lookups
CREATE INDEX IF NOT EXISTS "Notification_userId_createdAt_idx"
ON "Notification"("userId", "createdAt");

CREATE INDEX IF NOT EXISTS "Notification_userId_read_createdAt_idx"
ON "Notification"("userId", "read", "createdAt");

CREATE INDEX IF NOT EXISTS "Notification_customerId_createdAt_idx"
ON "Notification"("customerId", "createdAt");

-- Support ticket list filters
CREATE INDEX IF NOT EXISTS "SupportTicket_assignedTechnicianId_status_createdAt_idx"
ON "SupportTicket"("assignedTechnicianId", "status", "createdAt");

CREATE INDEX IF NOT EXISTS "SupportTicket_projectId_status_createdAt_idx"
ON "SupportTicket"("projectId", "status", "createdAt");

CREATE INDEX IF NOT EXISTS "SupportTicket_status_priority_createdAt_idx"
ON "SupportTicket"("status", "priority", "createdAt");

-- Project task recency and timelines
CREATE INDEX IF NOT EXISTS "ProjectTask_assigneeId_updatedAt_idx"
ON "ProjectTask"("assigneeId", "updatedAt");

CREATE INDEX IF NOT EXISTS "ProjectTaskComment_taskId_createdAt_idx"
ON "ProjectTaskComment"("taskId", "createdAt");

CREATE INDEX IF NOT EXISTS "ProjectTaskActivity_taskId_createdAt_idx"
ON "ProjectTaskActivity"("taskId", "createdAt");

CREATE INDEX IF NOT EXISTS "ProjectTaskAttachment_taskId_createdAt_idx"
ON "ProjectTaskAttachment"("taskId", "createdAt");

CREATE INDEX IF NOT EXISTS "ProjectTaskWorklog_taskId_loggedAt_idx"
ON "ProjectTaskWorklog"("taskId", "loggedAt");
