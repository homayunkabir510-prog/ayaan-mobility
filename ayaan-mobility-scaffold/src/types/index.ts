// Re-exports Prisma's generated types so app code can import domain types
// from "@/types" instead of reaching into "@prisma/client" everywhere.

export type {
  Role,
  VehicleCategory,
  FuelType,
  RentalType,
  DutyStatus,
  ClaimStatus,
  VehicleStatus,
  LanguagePreference,
  User,
  CarOwnerProfile,
  DriverProfile,
  Company,
  Vehicle,
  Agreement,
  DutyLog,
  ExpenseClaim,
  MaintenanceLog,
  Invoice,
  OwnerPayout,
  EmergencyAlert,
  AuditLog,
} from "@prisma/client";
