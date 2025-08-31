/*
  Warnings:

  - Changed the type of `permissionId` on the `role_permissions` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropForeignKey
ALTER TABLE "role_permissions" DROP CONSTRAINT "role_permissions_permissionId_fkey";

-- AlterTable
ALTER TABLE "role_permissions" DROP COLUMN "permissionId",
ADD COLUMN     "permissionId" JSONB NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_roleId_permissionId_key" ON "role_permissions"("roleId", "permissionId");
