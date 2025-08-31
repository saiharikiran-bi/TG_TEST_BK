/*
  Warnings:

  - The values [RESTRICTED,ELEVATED] on the enum `AccessLevel` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "AccessLevel_new" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'MODERATOR', 'ACCOUNTANT', 'NORMAL');
ALTER TABLE "roles" ALTER COLUMN "accessLevel" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "accessLevel" DROP DEFAULT;
ALTER TABLE "roles" ALTER COLUMN "accessLevel" TYPE "AccessLevel_new" USING ("accessLevel"::text::"AccessLevel_new");
ALTER TABLE "users" ALTER COLUMN "accessLevel" TYPE "AccessLevel_new" USING ("accessLevel"::text::"AccessLevel_new");
ALTER TYPE "AccessLevel" RENAME TO "AccessLevel_old";
ALTER TYPE "AccessLevel_new" RENAME TO "AccessLevel";
DROP TYPE "AccessLevel_old";
ALTER TABLE "roles" ALTER COLUMN "accessLevel" SET DEFAULT 'NORMAL';
ALTER TABLE "users" ALTER COLUMN "accessLevel" SET DEFAULT 'NORMAL';
COMMIT;
