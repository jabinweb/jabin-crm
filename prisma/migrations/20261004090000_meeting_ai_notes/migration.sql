-- AI meeting notes: live transcript segments + summary / key points / action items per team meeting.
-- Additive only (two new tables, no changes to existing ones); safe to re-run.

-- CreateTable
CREATE TABLE IF NOT EXISTS "MeetingNotes" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "aiNotesEnabled" BOOLEAN NOT NULL DEFAULT false,
    "aiNotesStartedById" TEXT,
    "aiNotesStartedAt" TIMESTAMP(3),
    "transcript" TEXT,
    "summary" TEXT,
    "keyPoints" JSONB,
    "actionItems" JSONB,
    "notesGeneratedAt" TIMESTAMP(3),
    "generatingAt" TIMESTAMP(3),
    "generationError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MeetingNotes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MeetingTranscriptSegment" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "speakerId" TEXT NOT NULL,
    "speakerName" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MeetingTranscriptSegment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "MeetingNotes_meetingId_key" ON "MeetingNotes"("meetingId");
CREATE INDEX IF NOT EXISTS "MeetingNotes_companyId_idx" ON "MeetingNotes"("companyId");
CREATE UNIQUE INDEX IF NOT EXISTS "MeetingTranscriptSegment_meetingId_speakerId_startedAt_key" ON "MeetingTranscriptSegment"("meetingId", "speakerId", "startedAt");
CREATE INDEX IF NOT EXISTS "MeetingTranscriptSegment_meetingId_startedAt_idx" ON "MeetingTranscriptSegment"("meetingId", "startedAt");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MeetingNotes_meetingId_fkey') THEN
    ALTER TABLE "MeetingNotes" ADD CONSTRAINT "MeetingNotes_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "TeamMeeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MeetingTranscriptSegment_meetingId_fkey') THEN
    ALTER TABLE "MeetingTranscriptSegment" ADD CONSTRAINT "MeetingTranscriptSegment_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "TeamMeeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
