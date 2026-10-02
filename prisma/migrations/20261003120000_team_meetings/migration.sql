-- Team meetings: invitations, RSVPs and video rooms on top of CalendarEvent.
-- Additive only (new enum values + two new tables); safe to re-run.

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'MEETING_INVITE';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'MEETING_UPDATED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'MEETING_CANCELLED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'MEETING_RSVP';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'MEETING_REMINDER';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'MEETING_STARTED';

-- CreateTable
CREATE TABLE IF NOT EXISTS "TeamMeeting" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "organizerId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'OPSLANE',
    "roomName" TEXT NOT NULL,
    "seriesId" TEXT,
    "recurrence" TEXT NOT NULL DEFAULT 'NONE',
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TeamMeeting_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MeetingAttendee" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'ATTENDEE',
    "rsvp" TEXT NOT NULL DEFAULT 'PENDING',
    "respondedAt" TIMESTAMP(3),
    "reminderSentAt" TIMESTAMP(3),
    "joinedAt" TIMESTAMP(3),
    "leftAt" TIMESTAMP(3),
    "inRoom" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MeetingAttendee_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "TeamMeeting_eventId_key" ON "TeamMeeting"("eventId");
CREATE UNIQUE INDEX IF NOT EXISTS "TeamMeeting_roomName_key" ON "TeamMeeting"("roomName");
CREATE INDEX IF NOT EXISTS "TeamMeeting_companyId_idx" ON "TeamMeeting"("companyId");
CREATE INDEX IF NOT EXISTS "TeamMeeting_organizerId_idx" ON "TeamMeeting"("organizerId");
CREATE INDEX IF NOT EXISTS "TeamMeeting_seriesId_idx" ON "TeamMeeting"("seriesId");
CREATE UNIQUE INDEX IF NOT EXISTS "MeetingAttendee_meetingId_userId_key" ON "MeetingAttendee"("meetingId", "userId");
CREATE INDEX IF NOT EXISTS "MeetingAttendee_userId_idx" ON "MeetingAttendee"("userId");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TeamMeeting_eventId_fkey') THEN
    ALTER TABLE "TeamMeeting" ADD CONSTRAINT "TeamMeeting_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CalendarEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TeamMeeting_companyId_fkey') THEN
    ALTER TABLE "TeamMeeting" ADD CONSTRAINT "TeamMeeting_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TeamMeeting_organizerId_fkey') THEN
    ALTER TABLE "TeamMeeting" ADD CONSTRAINT "TeamMeeting_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MeetingAttendee_meetingId_fkey') THEN
    ALTER TABLE "MeetingAttendee" ADD CONSTRAINT "MeetingAttendee_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "TeamMeeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MeetingAttendee_userId_fkey') THEN
    ALTER TABLE "MeetingAttendee" ADD CONSTRAINT "MeetingAttendee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
