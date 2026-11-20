CREATE TABLE "LoginRateLimit" (
    "keyHash" CHAR(64) NOT NULL,
    "windowStartedAt" TIMESTAMP(3) NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoginRateLimit_pkey" PRIMARY KEY ("keyHash")
);

CREATE INDEX "LoginRateLimit_updatedAt_idx" ON "LoginRateLimit"("updatedAt");
