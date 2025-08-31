/*
  Warnings:

  - You are about to drop the column `slab1_limit` on the `tariff` table. All the data in the column will be lost.
  - You are about to drop the column `slab1_unit_rate` on the `tariff` table. All the data in the column will be lost.
  - You are about to drop the column `slab2_limit` on the `tariff` table. All the data in the column will be lost.
  - You are about to drop the column `slab2_unit_rate` on the `tariff` table. All the data in the column will be lost.
  - You are about to drop the column `slab3_limit` on the `tariff` table. All the data in the column will be lost.
  - You are about to drop the column `slab3_unit_rate` on the `tariff` table. All the data in the column will be lost.
  - You are about to drop the `user_roles` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "user_roles" DROP CONSTRAINT "user_roles_roleId_fkey";

-- DropForeignKey
ALTER TABLE "user_roles" DROP CONSTRAINT "user_roles_userId_fkey";

-- AlterTable
ALTER TABLE "tariff" DROP COLUMN "slab1_limit",
DROP COLUMN "slab1_unit_rate",
DROP COLUMN "slab2_limit",
DROP COLUMN "slab2_unit_rate",
DROP COLUMN "slab3_limit",
DROP COLUMN "slab3_unit_rate";

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "roleId" INTEGER;

-- DropTable
DROP TABLE "user_roles";

-- CreateTable
CREATE TABLE "tariff_slabs" (
    "id" SERIAL NOT NULL,
    "tariff_id" INTEGER NOT NULL,
    "slab_order" INTEGER NOT NULL,
    "unit_limit" INTEGER NOT NULL,
    "unit_rate" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tariff_slabs_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tariff_slabs" ADD CONSTRAINT "tariff_slabs_tariff_id_fkey" FOREIGN KEY ("tariff_id") REFERENCES "tariff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
