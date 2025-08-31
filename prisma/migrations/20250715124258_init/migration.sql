-- CreateEnum
CREATE TYPE "AccessLevel" AS ENUM ('RESTRICTED', 'NORMAL', 'ELEVATED', 'ADMIN', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "IdType" AS ENUM ('PASSPORT', 'DRIVING_LICENSE', 'NATIONAL_ID', 'VOTER_ID', 'TAX_ID');

-- CreateEnum
CREATE TYPE "ConnectionType" AS ENUM ('RESIDENTIAL', 'COMMERCIAL', 'INDUSTRIAL', 'AGRICULTURAL');

-- CreateEnum
CREATE TYPE "ConsumerCategory" AS ENUM ('DOMESTIC', 'SMALL_COMMERCIAL', 'LARGE_COMMERCIAL', 'INDUSTRIAL', 'AGRICULTURAL', 'GOVERNMENT');

-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'BIMONTHLY', 'QUARTERLY');

-- CreateEnum
CREATE TYPE "BillDeliveryMode" AS ENUM ('EMAIL', 'SMS', 'WHATSAPP', 'PHYSICAL');

-- CreateEnum
CREATE TYPE "PaymentMode" AS ENUM ('CASH', 'CHEQUE', 'CARD', 'UPI', 'NETBANKING', 'WALLET');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "MeterType" AS ENUM ('PREPAID', 'POSTPAID');

-- CreateEnum
CREATE TYPE "MeterStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'FAULTY', 'DISCONNECTED');

-- CreateEnum
CREATE TYPE "ReadingType" AS ENUM ('REGULAR', 'SPECIAL', 'PROVISIONAL', 'FINAL');

-- CreateEnum
CREATE TYPE "ReadingSource" AS ENUM ('AMR', 'MANUAL', 'MOBILE_APP', 'ESTIMATED');

-- CreateEnum
CREATE TYPE "BillStatus" AS ENUM ('GENERATED', 'VERIFIED', 'APPROVED', 'DISPUTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('BILL_GENERATED', 'PAYMENT_DUE', 'PAYMENT_RECEIVED', 'LOW_BALANCE', 'METER_DISCONNECTED');

-- CreateEnum
CREATE TYPE "NotificationPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('SMS', 'EMAIL', 'PUSH', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'FAILED');

-- CreateEnum
CREATE TYPE "TicketType" AS ENUM ('COMPLAINT', 'SERVICE_REQUEST', 'INQUIRY');

-- CreateEnum
CREATE TYPE "TicketCategory" AS ENUM ('BILLING', 'METER', 'CONNECTION', 'TECHNICAL', 'OTHER');

-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "DTRType" AS ENUM ('DISTRIBUTION', 'POWER', 'AUTO', 'SPECIAL_PURPOSE');

-- CreateEnum
CREATE TYPE "CoolingType" AS ENUM ('ONAN', 'ONAF', 'OFAF', 'ODAF');

-- CreateEnum
CREATE TYPE "OilType" AS ENUM ('MINERAL', 'SYNTHETIC', 'BIO_BASED', 'SILICONE');

-- CreateEnum
CREATE TYPE "DTRStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'MAINTENANCE', 'FAULTY', 'OVERLOADED', 'DECOMMISSIONED');

-- CreateEnum
CREATE TYPE "DTRReadingType" AS ENUM ('REGULAR', 'SPECIAL', 'ALARM', 'FAULT');

-- CreateEnum
CREATE TYPE "MaintenanceType" AS ENUM ('ROUTINE', 'PREVENTIVE', 'CORRECTIVE', 'EMERGENCY', 'OIL_TEST', 'INSPECTION');

-- CreateEnum
CREATE TYPE "MaintenanceStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'DEFERRED');

-- CreateEnum
CREATE TYPE "FaultType" AS ENUM ('OVERLOAD', 'SHORT_CIRCUIT', 'EARTH_FAULT', 'OIL_LEAK', 'HIGH_TEMPERATURE', 'LOW_OIL', 'BUSHING_FAILURE', 'WINDING_FAILURE', 'OTHER');

-- CreateEnum
CREATE TYPE "FaultSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "FaultStatus" AS ENUM ('DETECTED', 'ANALYZING', 'REPAIRING', 'RESOLVED', 'UNRESOLVED');

-- CreateEnum
CREATE TYPE "ConnectionEventType" AS ENUM ('CONNECT', 'DISCONNECT');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CHEQUE', 'CARD', 'UPI', 'NETBANKING', 'WALLET');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "profileImage" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "lastLoginAt" TIMESTAMP(3),
    "passwordChangedAt" TIMESTAMP(3),
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockoutUntil" TIMESTAMP(3),
    "departmentId" INTEGER,
    "accessLevel" "AccessLevel" NOT NULL DEFAULT 'NORMAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" INTEGER,
    "updatedBy" INTEGER,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consumers" (
    "id" SERIAL NOT NULL,
    "consumerNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "primaryPhone" TEXT NOT NULL,
    "alternatePhone" TEXT,
    "idType" "IdType" NOT NULL,
    "idNumber" TEXT NOT NULL,
    "connectionType" "ConnectionType" NOT NULL,
    "category" "ConsumerCategory" NOT NULL,
    "sanctionedLoad" DOUBLE PRECISION NOT NULL,
    "connectionDate" TIMESTAMP(3) NOT NULL,
    "locationId" INTEGER NOT NULL,
    "billingCycle" "BillingCycle" NOT NULL,
    "billDeliveryMode" "BillDeliveryMode"[],
    "defaultPaymentMethod" "PaymentMethod",
    "creditScore" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consumers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locations" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "locationTypeId" INTEGER NOT NULL,
    "parentId" INTEGER,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "address" TEXT,
    "pincode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meters" (
    "id" SERIAL NOT NULL,
    "meterNumber" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "manufacturer" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "type" "MeterType" NOT NULL,
    "phase" INTEGER NOT NULL,
    "status" "MeterStatus" NOT NULL DEFAULT 'ACTIVE',
    "isInUse" BOOLEAN NOT NULL DEFAULT true,
    "installationDate" TIMESTAMP(3) NOT NULL,
    "lastMaintenanceDate" TIMESTAMP(3),
    "decommissionDate" TIMESTAMP(3),
    "consumerId" INTEGER NOT NULL,
    "locationId" INTEGER NOT NULL,
    "dtrId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meter_configurations" (
    "id" SERIAL NOT NULL,
    "meterId" INTEGER NOT NULL,
    "ctRatio" TEXT NOT NULL,
    "ctRatioPrimary" DOUBLE PRECISION NOT NULL,
    "ctRatioSecondary" DOUBLE PRECISION NOT NULL,
    "adoptedCTRatio" TEXT,
    "ctAccuracyClass" TEXT,
    "ctBurden" DOUBLE PRECISION,
    "ptRatio" TEXT NOT NULL,
    "ptRatioPrimary" DOUBLE PRECISION NOT NULL,
    "ptRatioSecondary" DOUBLE PRECISION NOT NULL,
    "adoptedPTRatio" TEXT,
    "ptAccuracyClass" TEXT,
    "ptBurden" DOUBLE PRECISION,
    "mf" DOUBLE PRECISION NOT NULL,
    "vmf" DOUBLE PRECISION NOT NULL,
    "cmf" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meter_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meter_readings" (
    "id" SERIAL NOT NULL,
    "meterId" INTEGER NOT NULL,
    "readingDate" TIMESTAMP(3) NOT NULL,
    "readingType" "ReadingType" NOT NULL,
    "readingSource" "ReadingSource" NOT NULL,
    "kWh" DOUBLE PRECISION NOT NULL,
    "kVAh" DOUBLE PRECISION NOT NULL,
    "kVARh" DOUBLE PRECISION,
    "powerFactor" DOUBLE PRECISION,
    "averagePF" DOUBLE PRECISION,
    "minimumPF" DOUBLE PRECISION,
    "voltageR" DOUBLE PRECISION,
    "voltageY" DOUBLE PRECISION,
    "voltageB" DOUBLE PRECISION,
    "averageVoltage" DOUBLE PRECISION,
    "currentR" DOUBLE PRECISION,
    "currentY" DOUBLE PRECISION,
    "currentB" DOUBLE PRECISION,
    "averageCurrent" DOUBLE PRECISION,
    "isValid" BOOLEAN NOT NULL DEFAULT true,
    "validatedBy" TEXT,
    "validatedAt" TIMESTAMP(3),
    "billId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meter_readings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consumption" (
    "id" SERIAL NOT NULL,
    "meterId" INTEGER NOT NULL,
    "previousValue" DOUBLE PRECISION NOT NULL,
    "finalValue" DOUBLE PRECISION NOT NULL,
    "consumption" DOUBLE PRECISION NOT NULL,
    "consumptionDate" TIMESTAMP(3) NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consumption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "raw_xml_import" (
    "id" SERIAL NOT NULL,
    "doc" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "raw_xml_import_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bills" (
    "id" SERIAL NOT NULL,
    "billNumber" TEXT NOT NULL,
    "meterId" INTEGER NOT NULL,
    "consumerId" INTEGER NOT NULL,
    "billMonth" INTEGER NOT NULL,
    "billYear" INTEGER NOT NULL,
    "fromDate" TIMESTAMP(3) NOT NULL,
    "toDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "previousReading" DOUBLE PRECISION NOT NULL,
    "currentReading" DOUBLE PRECISION NOT NULL,
    "unitsConsumed" DOUBLE PRECISION NOT NULL,
    "fixedCharge" DOUBLE PRECISION NOT NULL,
    "energyCharge" DOUBLE PRECISION NOT NULL,
    "powerFactorCharge" DOUBLE PRECISION,
    "otherCharges" JSONB,
    "subTotal" DOUBLE PRECISION NOT NULL,
    "taxes" JSONB NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "status" "BillStatus" NOT NULL DEFAULT 'GENERATED',
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" SERIAL NOT NULL,
    "transactionId" TEXT NOT NULL,
    "billId" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "paymentMode" "PaymentMode" NOT NULL,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "gatewayResponse" JSONB,
    "receiptNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" SERIAL NOT NULL,
    "consumerId" INTEGER NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "priority" "NotificationPriority" NOT NULL,
    "channels" "NotificationChannel"[],
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" SERIAL NOT NULL,
    "ticketNumber" TEXT NOT NULL,
    "consumerId" INTEGER NOT NULL,
    "raisedById" INTEGER NOT NULL,
    "assignedToId" INTEGER,
    "type" "TicketType" NOT NULL,
    "category" "TicketCategory" NOT NULL,
    "priority" "TicketPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dtrs" (
    "id" SERIAL NOT NULL,
    "dtrNumber" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "manufacturer" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "capacity" DOUBLE PRECISION NOT NULL,
    "type" "DTRType" NOT NULL,
    "phase" INTEGER NOT NULL,
    "primaryVoltage" DOUBLE PRECISION NOT NULL,
    "secondaryVoltage" DOUBLE PRECISION NOT NULL,
    "frequency" DOUBLE PRECISION,
    "impedance" DOUBLE PRECISION,
    "coolingType" "CoolingType" NOT NULL,
    "oilType" "OilType",
    "oilCapacity" DOUBLE PRECISION,
    "locationId" INTEGER NOT NULL,
    "installationDate" TIMESTAMP(3) NOT NULL,
    "commissionDate" TIMESTAMP(3),
    "lastMaintenanceDate" TIMESTAMP(3),
    "maxLoadLimit" DOUBLE PRECISION,
    "alarmThreshold" DOUBLE PRECISION,
    "tripThreshold" DOUBLE PRECISION,
    "status" "DTRStatus" NOT NULL DEFAULT 'ACTIVE',
    "healthIndex" INTEGER,
    "temperature" DOUBLE PRECISION,
    "loadPercentage" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dtrs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dtr_readings" (
    "id" SERIAL NOT NULL,
    "dtrId" INTEGER NOT NULL,
    "readingDate" TIMESTAMP(3) NOT NULL,
    "readingType" "DTRReadingType" NOT NULL,
    "loadKVA" DOUBLE PRECISION NOT NULL,
    "loadPercentage" DOUBLE PRECISION NOT NULL,
    "primaryVoltage" JSONB NOT NULL,
    "secondaryVoltage" JSONB NOT NULL,
    "primaryCurrent" JSONB NOT NULL,
    "secondaryCurrent" JSONB NOT NULL,
    "powerFactor" DOUBLE PRECISION,
    "oilTemperature" DOUBLE PRECISION,
    "windingTemperature" DOUBLE PRECISION,
    "ambientTemperature" DOUBLE PRECISION,
    "frequency" DOUBLE PRECISION,
    "voltageUnbalance" DOUBLE PRECISION,
    "currentUnbalance" DOUBLE PRECISION,
    "isValid" BOOLEAN NOT NULL DEFAULT true,
    "validatedBy" TEXT,
    "validatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dtr_readings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dtr_maintenance" (
    "id" SERIAL NOT NULL,
    "dtrId" INTEGER NOT NULL,
    "maintenanceType" "MaintenanceType" NOT NULL,
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "completedDate" TIMESTAMP(3),
    "workDone" TEXT NOT NULL,
    "findings" TEXT,
    "recommendations" TEXT,
    "oilDielectricTest" DOUBLE PRECISION,
    "oilAcidityTest" DOUBLE PRECISION,
    "moistureContent" DOUBLE PRECISION,
    "performedBy" TEXT NOT NULL,
    "verifiedBy" TEXT,
    "status" "MaintenanceStatus" NOT NULL DEFAULT 'SCHEDULED',
    "documents" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dtr_maintenance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dtr_faults" (
    "id" SERIAL NOT NULL,
    "dtrId" INTEGER NOT NULL,
    "faultType" "FaultType" NOT NULL,
    "severity" "FaultSeverity" NOT NULL,
    "occuredAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "description" TEXT NOT NULL,
    "rootCause" TEXT,
    "resolution" TEXT,
    "affectedMeters" INTEGER,
    "outageMinutes" INTEGER,
    "status" "FaultStatus" NOT NULL DEFAULT 'DETECTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dtr_faults_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meter_connection_events" (
    "id" SERIAL NOT NULL,
    "meterId" INTEGER NOT NULL,
    "eventType" "ConnectionEventType" NOT NULL,
    "eventTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,
    "performedBy" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meter_connection_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "roleId" INTEGER NOT NULL,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" SERIAL NOT NULL,
    "roleId" INTEGER NOT NULL,
    "permissionId" INTEGER NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_permissions" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "permissionId" INTEGER NOT NULL,

    CONSTRAINT "user_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_sessions" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_history" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "loginAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "login_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_activity_logs" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consumer_documents" (
    "id" SERIAL NOT NULL,
    "consumerId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consumer_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "location_types" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "location_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "current_transformers" (
    "id" SERIAL NOT NULL,
    "meterId" INTEGER NOT NULL,
    "ratio" TEXT NOT NULL,
    "accuracy" TEXT,
    "burden" DOUBLE PRECISION,

    CONSTRAINT "current_transformers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "potential_transformers" (
    "id" SERIAL NOT NULL,
    "meterId" INTEGER NOT NULL,
    "ratio" TEXT NOT NULL,
    "accuracy" TEXT,
    "burden" DOUBLE PRECISION,

    CONSTRAINT "potential_transformers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "consumers_consumerNumber_key" ON "consumers"("consumerNumber");

-- CreateIndex
CREATE UNIQUE INDEX "consumers_locationId_key" ON "consumers"("locationId");

-- CreateIndex
CREATE UNIQUE INDEX "locations_code_key" ON "locations"("code");

-- CreateIndex
CREATE UNIQUE INDEX "meters_meterNumber_key" ON "meters"("meterNumber");

-- CreateIndex
CREATE UNIQUE INDEX "meters_serialNumber_key" ON "meters"("serialNumber");

-- CreateIndex
CREATE UNIQUE INDEX "meter_configurations_meterId_key" ON "meter_configurations"("meterId");

-- CreateIndex
CREATE INDEX "meter_readings_meterId_readingDate_idx" ON "meter_readings"("meterId", "readingDate");

-- CreateIndex
CREATE INDEX "consumption_meterId_timestamp_idx" ON "consumption"("meterId", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "bills_billNumber_key" ON "bills"("billNumber");

-- CreateIndex
CREATE UNIQUE INDEX "payments_transactionId_key" ON "payments"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_ticketNumber_key" ON "tickets"("ticketNumber");

-- CreateIndex
CREATE UNIQUE INDEX "dtrs_dtrNumber_key" ON "dtrs"("dtrNumber");

-- CreateIndex
CREATE UNIQUE INDEX "dtrs_serialNumber_key" ON "dtrs"("serialNumber");

-- CreateIndex
CREATE INDEX "dtr_readings_dtrId_readingDate_idx" ON "dtr_readings"("dtrId", "readingDate");

-- CreateIndex
CREATE INDEX "meter_connection_events_meterId_eventTime_idx" ON "meter_connection_events"("meterId", "eventTime");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_userId_roleId_key" ON "user_roles"("userId", "roleId");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_roleId_permissionId_key" ON "role_permissions"("roleId", "permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_name_key" ON "permissions"("name");

-- CreateIndex
CREATE UNIQUE INDEX "user_permissions_userId_permissionId_key" ON "user_permissions"("userId", "permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "departments_name_key" ON "departments"("name");

-- CreateIndex
CREATE UNIQUE INDEX "user_sessions_token_key" ON "user_sessions"("token");

-- CreateIndex
CREATE UNIQUE INDEX "location_types_name_key" ON "location_types"("name");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumers" ADD CONSTRAINT "consumers_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_locationTypeId_fkey" FOREIGN KEY ("locationTypeId") REFERENCES "location_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meters" ADD CONSTRAINT "meters_consumerId_fkey" FOREIGN KEY ("consumerId") REFERENCES "consumers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meters" ADD CONSTRAINT "meters_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meters" ADD CONSTRAINT "meters_dtrId_fkey" FOREIGN KEY ("dtrId") REFERENCES "dtrs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meter_configurations" ADD CONSTRAINT "meter_configurations_meterId_fkey" FOREIGN KEY ("meterId") REFERENCES "meters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meter_readings" ADD CONSTRAINT "meter_readings_meterId_fkey" FOREIGN KEY ("meterId") REFERENCES "meters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meter_readings" ADD CONSTRAINT "meter_readings_billId_fkey" FOREIGN KEY ("billId") REFERENCES "bills"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumption" ADD CONSTRAINT "consumption_meterId_fkey" FOREIGN KEY ("meterId") REFERENCES "meters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills" ADD CONSTRAINT "bills_meterId_fkey" FOREIGN KEY ("meterId") REFERENCES "meters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills" ADD CONSTRAINT "bills_consumerId_fkey" FOREIGN KEY ("consumerId") REFERENCES "consumers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_billId_fkey" FOREIGN KEY ("billId") REFERENCES "bills"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_consumerId_fkey" FOREIGN KEY ("consumerId") REFERENCES "consumers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_consumerId_fkey" FOREIGN KEY ("consumerId") REFERENCES "consumers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_raisedById_fkey" FOREIGN KEY ("raisedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dtrs" ADD CONSTRAINT "dtrs_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dtr_readings" ADD CONSTRAINT "dtr_readings_dtrId_fkey" FOREIGN KEY ("dtrId") REFERENCES "dtrs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dtr_maintenance" ADD CONSTRAINT "dtr_maintenance_dtrId_fkey" FOREIGN KEY ("dtrId") REFERENCES "dtrs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dtr_faults" ADD CONSTRAINT "dtr_faults_dtrId_fkey" FOREIGN KEY ("dtrId") REFERENCES "dtrs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meter_connection_events" ADD CONSTRAINT "meter_connection_events_meterId_fkey" FOREIGN KEY ("meterId") REFERENCES "meters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "login_history" ADD CONSTRAINT "login_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_activity_logs" ADD CONSTRAINT "user_activity_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumer_documents" ADD CONSTRAINT "consumer_documents_consumerId_fkey" FOREIGN KEY ("consumerId") REFERENCES "consumers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "current_transformers" ADD CONSTRAINT "current_transformers_meterId_fkey" FOREIGN KEY ("meterId") REFERENCES "meters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "potential_transformers" ADD CONSTRAINT "potential_transformers_meterId_fkey" FOREIGN KEY ("meterId") REFERENCES "meters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
