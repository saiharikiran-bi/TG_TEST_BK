-- Add accessLevel column to roles table
ALTER TABLE "roles" ADD COLUMN "accessLevel" "AccessLevel" NOT NULL DEFAULT 'NORMAL';

-- Update existing roles with appropriate access levels
UPDATE "roles" SET "accessLevel" = 'SUPER_ADMIN' WHERE "name" = 'SUPER_ADMIN';
UPDATE "roles" SET "accessLevel" = 'ADMIN' WHERE "name" = 'ADMIN';
UPDATE "roles" SET "accessLevel" = 'MODERATOR' WHERE "name" = 'MODERATOR';
UPDATE "roles" SET "accessLevel" = 'ACCOUNTANT' WHERE "name" = 'ACCOUNTANT';
UPDATE "roles" SET "accessLevel" = 'NORMAL' WHERE "name" = 'USER';
