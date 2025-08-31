-- CreateTable
CREATE TABLE "tariff" (
    "id" SERIAL NOT NULL,
    "client_id" INTEGER NOT NULL,
    "category" INTEGER NOT NULL,
    "tariff_name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "device" TEXT NOT NULL,
    "min_demand" INTEGER NOT NULL,
    "min_demand_unit_rate" DOUBLE PRECISION NOT NULL,
    "min_demand_excess_unit_rate" DOUBLE PRECISION NOT NULL,
    "slab1_limit" INTEGER NOT NULL,
    "slab1_unit_rate" DOUBLE PRECISION NOT NULL,
    "slab2_limit" INTEGER NOT NULL,
    "slab2_unit_rate" DOUBLE PRECISION NOT NULL,
    "slab3_limit" INTEGER NOT NULL,
    "slab3_unit_rate" DOUBLE PRECISION NOT NULL,
    "base_unit_rate" DOUBLE PRECISION NOT NULL,
    "elec_duty_unit_rate" DOUBLE PRECISION NOT NULL,
    "ims" DOUBLE PRECISION NOT NULL,
    "gst" DOUBLE PRECISION NOT NULL,
    "valid_from" TIMESTAMP(3),
    "valid_to" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tariff_pkey" PRIMARY KEY ("id")
); 