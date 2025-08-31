-- CreateTable
CREATE TABLE "modems" (
    "modem_id" SERIAL NOT NULL,
    "modem_sl_no" TEXT NOT NULL,
    "hw_version" TEXT,
    "fw_version" TEXT,
    "mobile" TEXT,
    "delivery_date" TIMESTAMP(3),
    "imei" TEXT,
    "simno" TEXT,
    "changed_by" TEXT,
    "changed_datetime" TEXT,
    "ip" TEXT,
    "log_timestamp" TIMESTAMP(3),
    "sim_no" TEXT,

    CONSTRAINT "modems_pkey" PRIMARY KEY ("modem_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "modems_modem_sl_no_key" ON "modems"("modem_sl_no");

-- AddForeignKey
ALTER TABLE "modems" ADD CONSTRAINT "modems_modem_sl_no_fkey" FOREIGN KEY ("modem_sl_no") REFERENCES "meters"("serialNumber") ON DELETE RESTRICT ON UPDATE CASCADE;
