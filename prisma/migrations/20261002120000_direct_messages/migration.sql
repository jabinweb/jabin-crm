-- CreateTable
CREATE TABLE IF NOT EXISTS "DirectMessage" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DirectMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DirectMessage_companyId_senderId_receiverId_createdAt_idx" ON "DirectMessage"("companyId", "senderId", "receiverId", "createdAt");
CREATE INDEX IF NOT EXISTS "DirectMessage_companyId_receiverId_readAt_idx" ON "DirectMessage"("companyId", "receiverId", "readAt");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DirectMessage_companyId_fkey') THEN
    ALTER TABLE "DirectMessage" ADD CONSTRAINT "DirectMessage_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DirectMessage_senderId_fkey') THEN
    ALTER TABLE "DirectMessage" ADD CONSTRAINT "DirectMessage_senderId_fkey"
      FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DirectMessage_receiverId_fkey') THEN
    ALTER TABLE "DirectMessage" ADD CONSTRAINT "DirectMessage_receiverId_fkey"
      FOREIGN KEY ("receiverId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Carry over existing employee chats where both sides have a login.
-- Conversations with an employee who has no user account cannot be shown in the new chat.
INSERT INTO "DirectMessage" ("id", "companyId", "senderId", "receiverId", "content", "readAt", "createdAt")
SELECT m."id", s."companyId", s."userId", r."userId", m."content",
       CASE WHEN m."status" = 'SENT' THEN NULL ELSE m."updatedAt" END,
       m."createdAt"
FROM "EmployeeMessage" m
JOIN "Employee" s ON s."id" = m."senderId"
JOIN "Employee" r ON r."id" = m."receiverId"
WHERE s."userId" IS NOT NULL AND r."userId" IS NOT NULL AND s."userId" <> r."userId"
ON CONFLICT ("id") DO NOTHING;
