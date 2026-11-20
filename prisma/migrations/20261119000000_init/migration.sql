-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'OPERATIONS_ADMIN', 'ACCOUNTS_ADMIN', 'CLIENT_USER', 'CAR_OWNER', 'DRIVER');

-- CreateEnum
CREATE TYPE "VehicleCategory" AS ENUM ('SEDAN_AXIO', 'SEDAN_PREMIO_ALLION', 'NOAH_HIACE', 'NISSAN_XTRAIL', 'TOYOTA_HARRIER', 'PRADO', 'LAND_CRUISER_PRADO', 'CIVILIAN_COASTER', 'BMW_MERCEDES_SEDAN', 'RANGE_ROVER_BMW_MERCEDES_SUV', 'AMBULANCE', 'AC_BUS', 'CUSTOM');

-- CreateEnum
CREATE TYPE "FuelType" AS ENUM ('CNG', 'LPG', 'OCTANE', 'PETROL', 'DIESEL', 'OCTANE_AND_CNG', 'OCTANE_AND_LPG');

-- CreateEnum
CREATE TYPE "RentalType" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY_CORPORATE');

-- CreateEnum
CREATE TYPE "DutyStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'EDITED_BY_ADMIN');

-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "VehicleStatus" AS ENUM ('ACTIVE', 'IN_DUTY', 'MAINTENANCE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "LanguagePreference" AS ENUM ('BANGLA', 'ENGLISH');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'DRIVER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "language" "LanguagePreference" NOT NULL DEFAULT 'BANGLA',
    "companyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CarOwnerProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nidNumber" TEXT,
    "bankName" TEXT,
    "accountNumber" TEXT,
    "bkashNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CarOwnerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriverProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "licenseNumber" TEXT NOT NULL,
    "licenseExpiry" TIMESTAMP(3) NOT NULL,
    "licenseImage" TEXT,
    "photoUrl" TEXT,
    "nidNumber" TEXT,
    "walletBalance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DriverProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactPerson" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "regNumber" TEXT NOT NULL,
    "category" "VehicleCategory" NOT NULL,
    "modelYear" INTEGER NOT NULL,
    "fuelType" "FuelType" NOT NULL,
    "status" "VehicleStatus" NOT NULL DEFAULT 'ACTIVE',
    "carPhotoUrl" TEXT,
    "taxTokenExpiry" TIMESTAMP(3),
    "fitnessExpiry" TIMESTAMP(3),
    "routePermitExpiry" TIMESTAMP(3),
    "insuranceExpiry" TIMESTAMP(3),
    "carOwnerId" TEXT NOT NULL,
    "currentDriverId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Agreement" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "rentalType" "RentalType" NOT NULL DEFAULT 'MONTHLY_CORPORATE',
    "baseRent" DECIMAL(12,2) NOT NULL,
    "monthlyFuelQuotaLiters" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "cngRatePerKm" DECIMAL(12,2) NOT NULL DEFAULT 10.0,
    "lpgRatePerKm" DECIMAL(12,2) NOT NULL DEFAULT 10.0,
    "octaneRatePerKm" DECIMAL(12,2) NOT NULL DEFAULT 15.0,
    "standardDutyHours" INTEGER NOT NULL DEFAULT 10,
    "overtimeRatePerHour" DECIMAL(12,2) NOT NULL DEFAULT 100.0,
    "fridayHolidayOvertime" BOOLEAN NOT NULL DEFAULT true,
    "lunchAllowance" DECIMAL(12,2) NOT NULL DEFAULT 200.0,
    "dinnerAllowance" DECIMAL(12,2) NOT NULL DEFAULT 150.0,
    "tourAllowancePerDay" DECIMAL(12,2) NOT NULL DEFAULT 1200.0,
    "allowTollParkingClaim" BOOLEAN NOT NULL DEFAULT true,
    "ownerCommissionTierPct" DECIMAL(5,2) NOT NULL DEFAULT 10.0,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Agreement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DutyLog" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "driverId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,
    "idempotencyKey" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL,
    "startOdometer" DOUBLE PRECISION NOT NULL,
    "startOdometerImg" TEXT NOT NULL,
    "startLocation" TEXT,
    "endTime" TIMESTAMP(3),
    "endOdometer" DOUBLE PRECISION,
    "endOdometerImg" TEXT,
    "endLocation" TEXT,
    "routeNotes" TEXT,
    "totalKm" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "dutyHours" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "overtimeHours" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "fuelBill" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "overtimeBill" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "lunchBill" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "dinnerBill" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "tourAllowance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "tollParkingBill" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalDailyBill" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "isHoliday" BOOLEAN NOT NULL DEFAULT false,
    "isOutsideDhakaTour" BOOLEAN NOT NULL DEFAULT false,
    "status" "DutyStatus" NOT NULL DEFAULT 'APPROVED',
    "approvedById" TEXT,
    "adminEditNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DutyLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseClaim" (
    "id" TEXT NOT NULL,
    "dutyLogId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "expenseType" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "receiptImg" TEXT NOT NULL,
    "status" "ClaimStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExpenseClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceLog" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "serviceType" TEXT NOT NULL,
    "cost" DECIMAL(12,2) NOT NULL,
    "servicedBy" TEXT NOT NULL,
    "receiptUrl" TEXT,
    "description" TEXT,
    "serviceDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaintenanceLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "baseRentTotal" DECIMAL(12,2) NOT NULL,
    "fuelTotal" DECIMAL(12,2) NOT NULL,
    "overtimeTotal" DECIMAL(12,2) NOT NULL,
    "allowanceTotal" DECIMAL(12,2) NOT NULL,
    "tollTotal" DECIMAL(12,2) NOT NULL,
    "grandTotal" DECIMAL(12,2) NOT NULL,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "pdfUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OwnerPayout" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "totalGrossEarn" DECIMAL(12,2) NOT NULL,
    "commissionDeducted" DECIMAL(12,2) NOT NULL,
    "maintenanceDeducted" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "netPayoutAmount" DECIMAL(12,2) NOT NULL,
    "isSettled" BOOLEAN NOT NULL DEFAULT false,
    "transactionRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OwnerPayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmergencyAlert" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "location" TEXT,
    "message" TEXT NOT NULL DEFAULT 'SOS Breakdown Alert',
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmergencyAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityName" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_phone_email_role_idx" ON "User"("phone", "email", "role");

-- CreateIndex
CREATE INDEX "User_companyId_idx" ON "User"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "CarOwnerProfile_userId_key" ON "CarOwnerProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DriverProfile_userId_key" ON "DriverProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DriverProfile_licenseNumber_key" ON "DriverProfile"("licenseNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_regNumber_key" ON "Vehicle"("regNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_currentDriverId_key" ON "Vehicle"("currentDriverId");

-- CreateIndex
CREATE UNIQUE INDEX "DutyLog_idempotencyKey_key" ON "DutyLog"("idempotencyKey");

-- CreateIndex
CREATE INDEX "DutyLog_driverId_date_companyId_idx" ON "DutyLog"("driverId", "date", "companyId");

-- CreateIndex
CREATE INDEX "DutyLog_agreementId_idx" ON "DutyLog"("agreementId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_companyId_month_year_key" ON "Invoice"("companyId", "month", "year");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarOwnerProfile" ADD CONSTRAINT "CarOwnerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverProfile" ADD CONSTRAINT "DriverProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_carOwnerId_fkey" FOREIGN KEY ("carOwnerId") REFERENCES "CarOwnerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_currentDriverId_fkey" FOREIGN KEY ("currentDriverId") REFERENCES "DriverProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agreement" ADD CONSTRAINT "Agreement_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agreement" ADD CONSTRAINT "Agreement_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DutyLog" ADD CONSTRAINT "DutyLog_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "DriverProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DutyLog" ADD CONSTRAINT "DutyLog_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DutyLog" ADD CONSTRAINT "DutyLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DutyLog" ADD CONSTRAINT "DutyLog_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "Agreement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DutyLog" ADD CONSTRAINT "DutyLog_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseClaim" ADD CONSTRAINT "ExpenseClaim_dutyLogId_fkey" FOREIGN KEY ("dutyLogId") REFERENCES "DutyLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseClaim" ADD CONSTRAINT "ExpenseClaim_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "DriverProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceLog" ADD CONSTRAINT "MaintenanceLog_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnerPayout" ADD CONSTRAINT "OwnerPayout_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "CarOwnerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyAlert" ADD CONSTRAINT "EmergencyAlert_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "DriverProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
