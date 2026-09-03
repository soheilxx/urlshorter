-- CreateTable
CREATE TABLE "VoucherCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "batch" TEXT,
    "importedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VoucherCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoucherRedemption" (
    "id" TEXT NOT NULL,
    "voucherCodeId" TEXT NOT NULL,
    "retailer" TEXT NOT NULL,
    "retailerOther" TEXT,
    "orderNumberHash" TEXT NOT NULL,
    "orderNumberEncrypted" TEXT NOT NULL,
    "emailHash" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "acceptedTermsAt" TIMESTAMPTZ(3) NOT NULL,
    "termsVersion" TEXT NOT NULL,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmContent" TEXT,
    "utmTerm" TEXT,
    "referrer" TEXT,
    "landingHost" TEXT,
    "submissionIdentifier" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VoucherRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VoucherCode_code_key" ON "VoucherCode"("code");

-- CreateIndex
CREATE INDEX "VoucherCode_importedAt_idx" ON "VoucherCode"("importedAt");

-- CreateIndex
CREATE UNIQUE INDEX "VoucherRedemption_voucherCodeId_key" ON "VoucherRedemption"("voucherCodeId");

-- CreateIndex
CREATE UNIQUE INDEX "VoucherRedemption_orderNumberHash_key" ON "VoucherRedemption"("orderNumberHash");

-- CreateIndex
CREATE INDEX "VoucherRedemption_createdAt_idx" ON "VoucherRedemption"("createdAt");

-- CreateIndex
CREATE INDEX "VoucherRedemption_email_idx" ON "VoucherRedemption"("email");

-- CreateIndex
CREATE INDEX "VoucherRedemption_submissionIdentifier_createdAt_idx" ON "VoucherRedemption"("submissionIdentifier", "createdAt");

-- AddForeignKey
ALTER TABLE "VoucherRedemption" ADD CONSTRAINT "VoucherRedemption_voucherCodeId_fkey" FOREIGN KEY ("voucherCodeId") REFERENCES "VoucherCode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
