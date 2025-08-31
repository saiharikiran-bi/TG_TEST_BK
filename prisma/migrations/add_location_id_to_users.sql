-- Add location_id column to users table
ALTER TABLE "users" ADD COLUMN "locationId" INTEGER;

-- Add foreign key constraint
ALTER TABLE "users" ADD CONSTRAINT "users_locationId_fkey" 
FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add index for better performance
CREATE INDEX "users_locationId_idx" ON "users"("locationId");
