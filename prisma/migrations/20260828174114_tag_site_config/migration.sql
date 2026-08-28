-- CreateTable
CREATE TABLE "TagSiteConfig" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "domains" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "ga4MeasurementId" TEXT,
    "gtmContainerId" TEXT,
    "metaPixelId" TEXT,
    "metaCapiTokenEncrypted" TEXT,
    "tiktokPixelId" TEXT,
    "tiktokTokenEncrypted" TEXT,
    "redditPixelId" TEXT,
    "linkedinPartnerId" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "TagSiteConfig_pkey" PRIMARY KEY ("id")
);
