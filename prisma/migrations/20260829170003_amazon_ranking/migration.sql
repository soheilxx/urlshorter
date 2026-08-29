-- CreateEnum
CREATE TYPE "AmazonProviderKind" AS ENUM ('CREATORS', 'RAINFOREST', 'MANUAL');

-- CreateEnum
CREATE TYPE "AmazonSourceStatus" AS ENUM ('LIVE', 'PARTIAL', 'CACHED', 'MANUAL');

-- CreateEnum
CREATE TYPE "AmazonRunStatus" AS ENUM ('RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "AmazonBook" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "author" TEXT NOT NULL,
    "publisher" TEXT,
    "language" TEXT,
    "description" TEXT,
    "primaryEditionId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AmazonBook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AmazonEdition" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "marketplace" TEXT NOT NULL DEFAULT 'www.amazon.de',
    "asin" TEXT NOT NULL,
    "parentAsin" TEXT,
    "isbn10" TEXT,
    "isbn13" TEXT,
    "format" TEXT NOT NULL,
    "publicationDate" DATE,
    "preorder" BOOLEAN NOT NULL DEFAULT true,
    "preorderStartAt" TIMESTAMPTZ(3),
    "asinValidated" BOOLEAN NOT NULL DEFAULT false,
    "asinValidatedAt" TIMESTAMPTZ(3),
    "asinValidationProvider" "AmazonProviderKind",
    "productUrl" TEXT,
    "affiliateUrl" TEXT,
    "trackedShortCode" VARCHAR(4),
    "coverSmallUrl" TEXT,
    "coverMediumUrl" TEXT,
    "coverLargeUrl" TEXT,
    "coverWidth" INTEGER,
    "coverHeight" INTEGER,
    "currentPrice" DECIMAL(10,2),
    "currency" TEXT,
    "currentAvailability" TEXT,
    "currentRating" DOUBLE PRECISION,
    "currentReviewCount" INTEGER,
    "metadataProvider" "AmazonProviderKind",
    "metadataObservedAt" TIMESTAMPTZ(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AmazonEdition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AmazonCategory" (
    "id" TEXT NOT NULL,
    "marketplace" TEXT NOT NULL DEFAULT 'www.amazon.de',
    "canonicalName" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "path" TEXT,
    "parentId" TEXT,
    "categoryType" TEXT NOT NULL DEFAULT 'BROWSE_NODE',
    "isRoot" BOOLEAN NOT NULL DEFAULT false,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "autoFollow" BOOLEAN NOT NULL DEFAULT true,
    "leaderboardEnabled" BOOLEAN NOT NULL DEFAULT false,
    "leaderboardLimit" INTEGER NOT NULL DEFAULT 25,
    "refreshIntervalOverride" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastResolvedAt" TIMESTAMPTZ(3),
    "resolutionStatus" TEXT NOT NULL DEFAULT 'unresolved',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AmazonCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AmazonCategoryProviderMapping" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "provider" "AmazonProviderKind" NOT NULL,
    "providerCategoryId" TEXT NOT NULL,
    "providerCategoryName" TEXT,
    "providerCategoryPath" TEXT,
    "providerCategoryUrl" TEXT,
    "parentProviderCategoryId" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AmazonCategoryProviderMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AmazonEditionCategory" (
    "id" TEXT NOT NULL,
    "editionId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "discoveryProvider" "AmazonProviderKind",
    "autoDiscovered" BOOLEAN NOT NULL DEFAULT false,
    "currentlyRanked" BOOLEAN NOT NULL DEFAULT false,
    "firstSeenAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "AmazonEditionCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AmazonRankObservation" (
    "id" TEXT NOT NULL,
    "editionId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "rank" INTEGER,
    "provider" "AmazonProviderKind" NOT NULL,
    "providerPriority" INTEGER NOT NULL DEFAULT 0,
    "providerUpdatedAt" TIMESTAMPTZ(3),
    "observedAt" TIMESTAMPTZ(3) NOT NULL,
    "fetchedAt" TIMESTAMPTZ(3) NOT NULL,
    "freshnessSeconds" INTEGER,
    "sourceStatus" "AmazonSourceStatus" NOT NULL DEFAULT 'LIVE',
    "canonical" BOOLEAN NOT NULL DEFAULT false,
    "discrepancyFlag" BOOLEAN NOT NULL DEFAULT false,
    "providerDifference" INTEGER,
    "runId" TEXT,
    "payloadHash" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AmazonRankObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AmazonCanonicalRankSnapshot" (
    "id" TEXT NOT NULL,
    "editionId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "canonicalRank" INTEGER,
    "selectedProvider" "AmazonProviderKind",
    "selectionReason" TEXT NOT NULL,
    "observedAt" TIMESTAMPTZ(3) NOT NULL,
    "stale" BOOLEAN NOT NULL DEFAULT false,
    "dataGap" BOOLEAN NOT NULL DEFAULT false,
    "amazonObservationId" TEXT,
    "rainforestObservationId" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AmazonCanonicalRankSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AmazonLeaderboardSnapshot" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "provider" "AmazonProviderKind" NOT NULL,
    "observedAt" TIMESTAMPTZ(3) NOT NULL,
    "providerUpdatedAt" TIMESTAMPTZ(3),
    "fetchedAt" TIMESTAMPTZ(3) NOT NULL,
    "requestedLimit" INTEGER NOT NULL DEFAULT 25,
    "returnedCount" INTEGER NOT NULL,
    "complete" BOOLEAN NOT NULL DEFAULT true,
    "partialReason" TEXT,
    "stale" BOOLEAN NOT NULL DEFAULT false,
    "runId" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AmazonLeaderboardSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AmazonLeaderboardEntry" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "bestsellerRank" INTEGER NOT NULL,
    "asin" TEXT NOT NULL,
    "editionId" TEXT,
    "titleSnapshot" TEXT NOT NULL,
    "subTitleSnapshot" TEXT,
    "authorSnapshot" TEXT,
    "formatSnapshot" TEXT,
    "imageUrlSnapshot" TEXT,
    "productUrlSnapshot" TEXT,
    "affiliateUrlSnapshot" TEXT,
    "priceSnapshot" DECIMAL(10,2),
    "currencySnapshot" TEXT,
    "priceRawSnapshot" TEXT,
    "ratingSnapshot" DOUBLE PRECISION,
    "reviewCountSnapshot" INTEGER,
    "preorderSnapshot" BOOLEAN,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AmazonLeaderboardEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AmazonProductMetadataSnapshot" (
    "id" TEXT NOT NULL,
    "editionId" TEXT NOT NULL,
    "provider" "AmazonProviderKind" NOT NULL,
    "title" TEXT,
    "author" TEXT,
    "coverSmallUrl" TEXT,
    "coverMediumUrl" TEXT,
    "coverLargeUrl" TEXT,
    "price" DECIMAL(10,2),
    "currency" TEXT,
    "availability" TEXT,
    "rating" DOUBLE PRECISION,
    "reviewCount" INTEGER,
    "preorder" BOOLEAN,
    "observedAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AmazonProductMetadataSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AmazonProviderRun" (
    "id" TEXT NOT NULL,
    "provider" "AmazonProviderKind",
    "capability" TEXT,
    "jobType" TEXT NOT NULL,
    "scheduledAt" TIMESTAMPTZ(3),
    "startedAt" TIMESTAMPTZ(3) NOT NULL,
    "completedAt" TIMESTAMPTZ(3),
    "status" "AmazonRunStatus" NOT NULL DEFAULT 'RUNNING',
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "requestCount" INTEGER NOT NULL DEFAULT 0,
    "recordsRequested" INTEGER,
    "recordsReturned" INTEGER,
    "creditsUsed" INTEGER,
    "creditsRemaining" INTEGER,
    "latencyMs" INTEGER,
    "fallbackFrom" "AmazonProviderKind",
    "errorClass" TEXT,
    "errorCode" TEXT,
    "safeErrorMessage" TEXT,
    "httpStatus" INTEGER,
    "correlationId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AmazonProviderRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AmazonProviderStatus" (
    "provider" "AmazonProviderKind" NOT NULL,
    "configured" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "healthy" BOOLEAN NOT NULL DEFAULT false,
    "lastSuccessAt" TIMESTAMPTZ(3),
    "lastFailureAt" TIMESTAMPTZ(3),
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "circuitBreakerState" TEXT NOT NULL DEFAULT 'closed',
    "circuitOpenedAt" TIMESTAMPTZ(3),
    "currentLatencyMs" INTEGER,
    "quota" JSONB,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AmazonProviderStatus_pkey" PRIMARY KEY ("provider")
);

-- CreateTable
CREATE TABLE "AmazonJobState" (
    "jobType" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "intervalMinutes" INTEGER,
    "nextRunAt" TIMESTAMPTZ(3),
    "lockedUntil" TIMESTAMPTZ(3),
    "lockOwner" TEXT,
    "lastRunAt" TIMESTAMPTZ(3),
    "lastStatus" "AmazonRunStatus",
    "lastRunId" TEXT,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AmazonJobState_pkey" PRIMARY KEY ("jobType")
);

-- CreateTable
CREATE TABLE "AmazonRawPayload" (
    "id" TEXT NOT NULL,
    "provider" "AmazonProviderKind" NOT NULL,
    "capability" TEXT NOT NULL,
    "runId" TEXT,
    "payload" JSONB NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "fetchedAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AmazonRawPayload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AmazonAlertRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "editionId" TEXT,
    "categoryId" TEXT,
    "metric" TEXT NOT NULL,
    "operator" TEXT NOT NULL DEFAULT 'lte',
    "threshold" DECIMAL(12,4),
    "channels" TEXT NOT NULL DEFAULT 'inapp',
    "cooldownMinutes" INTEGER NOT NULL DEFAULT 360,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastTriggeredAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AmazonAlertRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AmazonAlertEvent" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT,
    "dedupeKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "channels" TEXT NOT NULL DEFAULT 'inapp',
    "triggeredAt" TIMESTAMPTZ(3) NOT NULL,
    "acknowledgedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AmazonAlertEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AmazonAnnotation" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMPTZ(3) NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'campaign',
    "campaign" TEXT,
    "shortLinkId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AmazonAnnotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AmazonDigestRun" (
    "id" TEXT NOT NULL,
    "calendarDate" DATE NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Berlin',
    "periodStart" TIMESTAMPTZ(3) NOT NULL,
    "periodEnd" TIMESTAMPTZ(3) NOT NULL,
    "status" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'inapp',
    "recipient" TEXT NOT NULL DEFAULT 'dashboard',
    "sentAt" TIMESTAMPTZ(3),
    "dataCompleteness" DOUBLE PRECISION,
    "summary" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AmazonDigestRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AmazonSalesEstimate" (
    "id" TEXT NOT NULL,
    "editionId" TEXT NOT NULL,
    "provider" "AmazonProviderKind" NOT NULL,
    "estimatedPeriod" TEXT NOT NULL,
    "estimateValue" INTEGER,
    "estimateLow" INTEGER,
    "estimateHigh" INTEGER,
    "confidence" TEXT,
    "methodology" TEXT,
    "observedAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AmazonSalesEstimate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AmazonActualSalesImport" (
    "id" TEXT NOT NULL,
    "editionId" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "units" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "importedBy" TEXT NOT NULL,
    "importedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AmazonActualSalesImport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AmazonBook_active_idx" ON "AmazonBook"("active");

-- CreateIndex
CREATE INDEX "AmazonEdition_bookId_idx" ON "AmazonEdition"("bookId");

-- CreateIndex
CREATE INDEX "AmazonEdition_active_idx" ON "AmazonEdition"("active");

-- CreateIndex
CREATE UNIQUE INDEX "AmazonEdition_marketplace_asin_key" ON "AmazonEdition"("marketplace", "asin");

-- CreateIndex
CREATE INDEX "AmazonCategory_marketplace_normalizedName_idx" ON "AmazonCategory"("marketplace", "normalizedName");

-- CreateIndex
CREATE INDEX "AmazonCategory_active_idx" ON "AmazonCategory"("active");

-- CreateIndex
CREATE INDEX "AmazonCategory_categoryType_idx" ON "AmazonCategory"("categoryType");

-- CreateIndex
CREATE INDEX "AmazonCategoryProviderMapping_provider_providerCategoryId_idx" ON "AmazonCategoryProviderMapping"("provider", "providerCategoryId");

-- CreateIndex
CREATE UNIQUE INDEX "AmazonCategoryProviderMapping_categoryId_provider_providerC_key" ON "AmazonCategoryProviderMapping"("categoryId", "provider", "providerCategoryId");

-- CreateIndex
CREATE INDEX "AmazonEditionCategory_categoryId_idx" ON "AmazonEditionCategory"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "AmazonEditionCategory_editionId_categoryId_key" ON "AmazonEditionCategory"("editionId", "categoryId");

-- CreateIndex
CREATE INDEX "AmazonRankObservation_editionId_categoryId_observedAt_idx" ON "AmazonRankObservation"("editionId", "categoryId", "observedAt");

-- CreateIndex
CREATE INDEX "AmazonRankObservation_observedAt_idx" ON "AmazonRankObservation"("observedAt");

-- CreateIndex
CREATE INDEX "AmazonRankObservation_runId_idx" ON "AmazonRankObservation"("runId");

-- CreateIndex
CREATE UNIQUE INDEX "AmazonRankObservation_editionId_categoryId_provider_observe_key" ON "AmazonRankObservation"("editionId", "categoryId", "provider", "observedAt");

-- CreateIndex
CREATE INDEX "AmazonCanonicalRankSnapshot_editionId_categoryId_observedAt_idx" ON "AmazonCanonicalRankSnapshot"("editionId", "categoryId", "observedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AmazonCanonicalRankSnapshot_editionId_categoryId_observedAt_key" ON "AmazonCanonicalRankSnapshot"("editionId", "categoryId", "observedAt");

-- CreateIndex
CREATE INDEX "AmazonLeaderboardSnapshot_categoryId_observedAt_idx" ON "AmazonLeaderboardSnapshot"("categoryId", "observedAt");

-- CreateIndex
CREATE INDEX "AmazonLeaderboardEntry_asin_idx" ON "AmazonLeaderboardEntry"("asin");

-- CreateIndex
CREATE UNIQUE INDEX "AmazonLeaderboardEntry_snapshotId_position_key" ON "AmazonLeaderboardEntry"("snapshotId", "position");

-- CreateIndex
CREATE INDEX "AmazonProductMetadataSnapshot_editionId_observedAt_idx" ON "AmazonProductMetadataSnapshot"("editionId", "observedAt");

-- CreateIndex
CREATE INDEX "AmazonProviderRun_jobType_startedAt_idx" ON "AmazonProviderRun"("jobType", "startedAt");

-- CreateIndex
CREATE INDEX "AmazonProviderRun_provider_startedAt_idx" ON "AmazonProviderRun"("provider", "startedAt");

-- CreateIndex
CREATE INDEX "AmazonProviderRun_correlationId_idx" ON "AmazonProviderRun"("correlationId");

-- CreateIndex
CREATE INDEX "AmazonRawPayload_createdAt_idx" ON "AmazonRawPayload"("createdAt");

-- CreateIndex
CREATE INDEX "AmazonRawPayload_provider_capability_fetchedAt_idx" ON "AmazonRawPayload"("provider", "capability", "fetchedAt");

-- CreateIndex
CREATE INDEX "AmazonAlertRule_enabled_idx" ON "AmazonAlertRule"("enabled");

-- CreateIndex
CREATE INDEX "AmazonAlertEvent_triggeredAt_idx" ON "AmazonAlertEvent"("triggeredAt");

-- CreateIndex
CREATE INDEX "AmazonAlertEvent_dedupeKey_triggeredAt_idx" ON "AmazonAlertEvent"("dedupeKey", "triggeredAt");

-- CreateIndex
CREATE INDEX "AmazonAnnotation_timestamp_idx" ON "AmazonAnnotation"("timestamp");

-- CreateIndex
CREATE INDEX "AmazonDigestRun_calendarDate_idx" ON "AmazonDigestRun"("calendarDate");

-- CreateIndex
CREATE UNIQUE INDEX "AmazonDigestRun_calendarDate_timezone_recipient_key" ON "AmazonDigestRun"("calendarDate", "timezone", "recipient");

-- CreateIndex
CREATE INDEX "AmazonSalesEstimate_editionId_observedAt_idx" ON "AmazonSalesEstimate"("editionId", "observedAt");

-- CreateIndex
CREATE INDEX "AmazonActualSalesImport_editionId_periodStart_idx" ON "AmazonActualSalesImport"("editionId", "periodStart");

-- AddForeignKey
ALTER TABLE "AmazonEdition" ADD CONSTRAINT "AmazonEdition_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "AmazonBook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmazonCategoryProviderMapping" ADD CONSTRAINT "AmazonCategoryProviderMapping_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "AmazonCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmazonEditionCategory" ADD CONSTRAINT "AmazonEditionCategory_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "AmazonEdition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmazonEditionCategory" ADD CONSTRAINT "AmazonEditionCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "AmazonCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmazonRankObservation" ADD CONSTRAINT "AmazonRankObservation_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "AmazonEdition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmazonRankObservation" ADD CONSTRAINT "AmazonRankObservation_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "AmazonCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmazonCanonicalRankSnapshot" ADD CONSTRAINT "AmazonCanonicalRankSnapshot_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "AmazonEdition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmazonCanonicalRankSnapshot" ADD CONSTRAINT "AmazonCanonicalRankSnapshot_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "AmazonCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmazonLeaderboardSnapshot" ADD CONSTRAINT "AmazonLeaderboardSnapshot_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "AmazonCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmazonLeaderboardEntry" ADD CONSTRAINT "AmazonLeaderboardEntry_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "AmazonLeaderboardSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmazonProductMetadataSnapshot" ADD CONSTRAINT "AmazonProductMetadataSnapshot_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "AmazonEdition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmazonAlertEvent" ADD CONSTRAINT "AmazonAlertEvent_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "AmazonAlertRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmazonSalesEstimate" ADD CONSTRAINT "AmazonSalesEstimate_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "AmazonEdition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmazonActualSalesImport" ADD CONSTRAINT "AmazonActualSalesImport_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "AmazonEdition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
