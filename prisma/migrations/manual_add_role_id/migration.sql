-- Add roleId column to users table
ALTER TABLE "users" ADD COLUMN "roleId" INTEGER;

-- Add foreign key constraint for roleId
ALTER TABLE "users" ADD CONSTRAINT "users_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Drop the user_roles table
DROP TABLE IF EXISTS "user_roles" CASCADE; 