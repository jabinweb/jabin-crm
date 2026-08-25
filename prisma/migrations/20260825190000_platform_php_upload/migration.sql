-- AlterTable
ALTER TABLE "PlatformSetting" ADD COLUMN IF NOT EXISTS "phpUploadUrl" TEXT;
ALTER TABLE "PlatformSetting" ADD COLUMN IF NOT EXISTS "phpUploadPassword" TEXT;

-- Seed default upload URL for the singleton row (create if missing)
INSERT INTO "PlatformSetting" ("id", "tenancyMode", "phpUploadUrl", "updatedAt")
VALUES ('default', 'path', 'https://files.jabin.org/api/upload.php', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE
SET "phpUploadUrl" = COALESCE(NULLIF("PlatformSetting"."phpUploadUrl", ''), 'https://files.jabin.org/api/upload.php');
