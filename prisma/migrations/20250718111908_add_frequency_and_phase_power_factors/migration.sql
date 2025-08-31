-- AlterTable
ALTER TABLE "meter_readings" ADD COLUMN     "bphPowerFactor" DOUBLE PRECISION,
ADD COLUMN     "frequency" DOUBLE PRECISION,
ADD COLUMN     "rphPowerFactor" DOUBLE PRECISION,
ADD COLUMN     "yphPowerFactor" DOUBLE PRECISION;
