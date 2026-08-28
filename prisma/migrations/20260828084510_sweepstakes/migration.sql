-- CreateEnum
CREATE TYPE "SweepstakesEntryStatus" AS ENUM ('RECEIVED', 'IN_REVIEW', 'REVIEWED', 'INVALID', 'WINNER', 'NOT_WON', 'DELETED');

-- CreateTable
CREATE TABLE "SweepstakesEntry" (
    "id" TEXT NOT NULL,
    "referenceNumber" TEXT NOT NULL,
    "retailer" TEXT NOT NULL,
    "retailerOther" TEXT,
    "orderNumberHash" TEXT NOT NULL,
    "orderNumberEncrypted" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "street" TEXT NOT NULL,
    "houseNumber" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "confirmedAccuracyAt" TIMESTAMPTZ(3) NOT NULL,
    "acceptedTermsAt" TIMESTAMPTZ(3) NOT NULL,
    "termsVersion" TEXT NOT NULL,
    "acknowledgedPrivacyAt" TIMESTAMPTZ(3) NOT NULL,
    "privacyVersion" TEXT NOT NULL,
    "status" "SweepstakesEntryStatus" NOT NULL DEFAULT 'RECEIVED',
    "internalNote" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmContent" TEXT,
    "utmTerm" TEXT,
    "referrer" TEXT,
    "landingHost" TEXT,
    "submissionIdentifier" TEXT,
    "emailConfirmationSentAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "SweepstakesEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SweepstakesEntry_referenceNumber_key" ON "SweepstakesEntry"("referenceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "SweepstakesEntry_orderNumberHash_key" ON "SweepstakesEntry"("orderNumberHash");

-- CreateIndex
CREATE INDEX "SweepstakesEntry_status_idx" ON "SweepstakesEntry"("status");

-- CreateIndex
CREATE INDEX "SweepstakesEntry_retailer_idx" ON "SweepstakesEntry"("retailer");

-- CreateIndex
CREATE INDEX "SweepstakesEntry_createdAt_idx" ON "SweepstakesEntry"("createdAt");

-- CreateIndex
CREATE INDEX "SweepstakesEntry_email_idx" ON "SweepstakesEntry"("email");

-- CreateIndex
CREATE INDEX "SweepstakesEntry_lastName_idx" ON "SweepstakesEntry"("lastName");

-- CreateIndex
CREATE INDEX "SweepstakesEntry_submissionIdentifier_createdAt_idx" ON "SweepstakesEntry"("submissionIdentifier", "createdAt");
