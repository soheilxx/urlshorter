-- CreateTable
CREATE TABLE "Destination" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Destination_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShortLink" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(4) NOT NULL,
    "name" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "medium" TEXT,
    "campaign" TEXT,
    "content" TEXT,
    "note" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMPTZ(3),
    "destinationId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ShortLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClickEvent" (
    "id" TEXT NOT NULL,
    "shortLinkId" TEXT NOT NULL,
    "code" VARCHAR(4) NOT NULL,
    "destinationId" TEXT NOT NULL,
    "ts" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "linkName" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "medium" TEXT,
    "campaign" TEXT,
    "content" TEXT,
    "referrer" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmContent" TEXT,
    "utmTerm" TEXT,
    "deviceType" TEXT,
    "browser" TEXT,
    "os" TEXT,
    "country" TEXT,
    "region" TEXT,
    "city" TEXT,
    "isBot" BOOLEAN NOT NULL DEFAULT false,
    "botReason" TEXT,
    "visitorHash" TEXT,
    "consent" BOOLEAN NOT NULL DEFAULT false,
    "bridgeLoaded" BOOLEAN NOT NULL DEFAULT false,
    "trackingFired" BOOLEAN NOT NULL DEFAULT false,
    "redirectStarted" BOOLEAN NOT NULL DEFAULT false,
    "manualClick" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ClickEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyAggregate" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "shortLinkId" TEXT,
    "code" TEXT,
    "source" TEXT,
    "campaign" TEXT,
    "humanClicks" INTEGER NOT NULL DEFAULT 0,
    "botClicks" INTEGER NOT NULL DEFAULT 0,
    "uniqueVisitors" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyAggregate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "ts" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "changes" JSONB,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "LoginAttempt" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "ts" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Destination_active_idx" ON "Destination"("active");

-- CreateIndex
CREATE UNIQUE INDEX "ShortLink_code_key" ON "ShortLink"("code");

-- CreateIndex
CREATE INDEX "ShortLink_destinationId_idx" ON "ShortLink"("destinationId");

-- CreateIndex
CREATE INDEX "ShortLink_active_idx" ON "ShortLink"("active");

-- CreateIndex
CREATE INDEX "ShortLink_source_idx" ON "ShortLink"("source");

-- CreateIndex
CREATE INDEX "ShortLink_campaign_idx" ON "ShortLink"("campaign");

-- CreateIndex
CREATE INDEX "ClickEvent_ts_idx" ON "ClickEvent"("ts");

-- CreateIndex
CREATE INDEX "ClickEvent_shortLinkId_ts_idx" ON "ClickEvent"("shortLinkId", "ts");

-- CreateIndex
CREATE INDEX "ClickEvent_isBot_ts_idx" ON "ClickEvent"("isBot", "ts");

-- CreateIndex
CREATE INDEX "ClickEvent_code_idx" ON "ClickEvent"("code");

-- CreateIndex
CREATE INDEX "ClickEvent_source_idx" ON "ClickEvent"("source");

-- CreateIndex
CREATE INDEX "ClickEvent_campaign_idx" ON "ClickEvent"("campaign");

-- CreateIndex
CREATE INDEX "ClickEvent_destinationId_idx" ON "ClickEvent"("destinationId");

-- CreateIndex
CREATE INDEX "ClickEvent_visitorHash_idx" ON "ClickEvent"("visitorHash");

-- CreateIndex
CREATE INDEX "DailyAggregate_date_idx" ON "DailyAggregate"("date");

-- CreateIndex
CREATE UNIQUE INDEX "DailyAggregate_date_shortLinkId_key" ON "DailyAggregate"("date", "shortLinkId");

-- CreateIndex
CREATE INDEX "AuditLog_ts_idx" ON "AuditLog"("ts");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "LoginAttempt_identifier_ts_idx" ON "LoginAttempt"("identifier", "ts");

-- AddForeignKey
ALTER TABLE "ShortLink" ADD CONSTRAINT "ShortLink_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "Destination"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClickEvent" ADD CONSTRAINT "ClickEvent_shortLinkId_fkey" FOREIGN KEY ("shortLinkId") REFERENCES "ShortLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;
