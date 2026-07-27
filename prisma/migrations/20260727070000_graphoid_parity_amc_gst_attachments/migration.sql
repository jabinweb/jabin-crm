-- AlterTable Invoice: GST fields
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "gstin" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "placeOfSupply" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "taxBreakup" JSONB;

-- AlterTable InvoiceItem: HSN/SAC
ALTER TABLE "InvoiceItem" ADD COLUMN IF NOT EXISTS "hsnSac" TEXT;

-- CreateIndex Invoice.dueDate
CREATE INDEX IF NOT EXISTS "Invoice_dueDate_idx" ON "Invoice"("dueDate");

-- AlterTable SupportTicket: link to ServiceContract
ALTER TABLE "SupportTicket" ADD COLUMN IF NOT EXISTS "serviceContractId" TEXT;

-- CreateIndex SupportTicket.serviceContractId
CREATE INDEX IF NOT EXISTS "SupportTicket_serviceContractId_idx" ON "SupportTicket"("serviceContractId");

-- AddForeignKey SupportTicket -> ServiceContract
DO $$ BEGIN
  ALTER TABLE "SupportTicket"
    ADD CONSTRAINT "SupportTicket_serviceContractId_fkey"
    FOREIGN KEY ("serviceContractId") REFERENCES "ServiceContract"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable TicketAttachment
CREATE TABLE IF NOT EXISTS "TicketAttachment" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "fileName" TEXT,
    "contentType" TEXT,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TicketAttachment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "TicketAttachment_ticketId_idx" ON "TicketAttachment"("ticketId");
CREATE INDEX IF NOT EXISTS "TicketAttachment_uploadedById_idx" ON "TicketAttachment"("uploadedById");

DO $$ BEGIN
  ALTER TABLE "TicketAttachment"
    ADD CONSTRAINT "TicketAttachment_ticketId_fkey"
    FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "TicketAttachment"
    ADD CONSTRAINT "TicketAttachment_uploadedById_fkey"
    FOREIGN KEY ("uploadedById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
