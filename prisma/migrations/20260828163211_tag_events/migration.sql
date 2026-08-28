-- CreateTable
CREATE TABLE "TagEvent" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "referrer" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmContent" TEXT,
    "utmTerm" TEXT,
    "country" TEXT,
    "region" TEXT,
    "city" TEXT,
    "deviceType" TEXT,
    "browser" TEXT,
    "os" TEXT,
    "visitorHash" TEXT,
    "cookieHash" TEXT,
    "isBot" BOOLEAN NOT NULL DEFAULT false,
    "metaForwardedAt" TIMESTAMPTZ(3),
    "tiktokForwardedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TagEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TagEvent_siteId_createdAt_idx" ON "TagEvent"("siteId", "createdAt");

-- CreateIndex
CREATE INDEX "TagEvent_eventName_createdAt_idx" ON "TagEvent"("eventName", "createdAt");

-- CreateIndex
CREATE INDEX "TagEvent_createdAt_idx" ON "TagEvent"("createdAt");

-- CreateIndex
CREATE INDEX "TagEvent_cookieHash_idx" ON "TagEvent"("cookieHash");
