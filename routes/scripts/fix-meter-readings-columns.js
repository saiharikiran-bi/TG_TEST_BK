import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function ensureMeterReadingColumns() {
  const sql = `
    ALTER TABLE "meter_readings"
      ADD COLUMN IF NOT EXISTS "bphPowerFactor" DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS "frequency" DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS "rphPowerFactor" DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS "yphPowerFactor" DOUBLE PRECISION;
  `;

  try {
    await prisma.$executeRawUnsafe(sql);
  } catch (error) {
    console.error('Failed to apply column fixes:', error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

ensureMeterReadingColumns();

