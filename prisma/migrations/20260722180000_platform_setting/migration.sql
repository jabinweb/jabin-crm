-- CreateTable
CREATE TABLE IF NOT EXISTS "PlatformSetting" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "tenancyMode" TEXT NOT NULL DEFAULT 'path',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "PlatformSetting_pkey" PRIMARY KEY ("id")
);
