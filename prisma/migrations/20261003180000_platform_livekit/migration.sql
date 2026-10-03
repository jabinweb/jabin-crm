-- Team meeting video (LiveKit) credentials, managed by super admins (env stays the fallback)
ALTER TABLE "PlatformSetting" ADD COLUMN IF NOT EXISTS "livekitUrl" TEXT;
ALTER TABLE "PlatformSetting" ADD COLUMN IF NOT EXISTS "livekitApiKey" TEXT;
ALTER TABLE "PlatformSetting" ADD COLUMN IF NOT EXISTS "livekitApiSecret" TEXT;
