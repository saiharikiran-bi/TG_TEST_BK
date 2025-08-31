-- Remove consumerId from meters table
ALTER TABLE "meters" DROP COLUMN IF EXISTS "consumerId";

-- Remove consumerId from tickets table and add dtrId
ALTER TABLE "tickets" DROP COLUMN IF EXISTS "consumerId";
ALTER TABLE "tickets" ADD COLUMN "dtrId" INTEGER;

-- Add foreign key constraint for tickets.dtrId
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_dtrId_fkey" FOREIGN KEY ("dtrId") REFERENCES "dtrs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Remove foreign key constraints for consumer relations
ALTER TABLE "tickets" DROP CONSTRAINT IF EXISTS "tickets_consumerId_fkey";
ALTER TABLE "meters" DROP CONSTRAINT IF EXISTS "meters_consumerId_fkey"; 