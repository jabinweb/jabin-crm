-- AlterEnum
ALTER TYPE "WhatsAppProvider" ADD VALUE 'SUMMORA';

-- AlterTable
ALTER TABLE "WhatsAppProviderConfig" ADD COLUMN "summoraBaseUrl" TEXT;
ALTER TABLE "WhatsAppProviderConfig" ADD COLUMN "summoraApiKey" TEXT;
