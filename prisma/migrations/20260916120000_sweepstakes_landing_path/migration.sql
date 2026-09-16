-- Kampagnenseite /verlosung: Teilnahmeweg und Gewinnumfang je Teilnahme speichern.
-- Additiv (nullable) – bestehende Teilnahmen bleiben unverändert.
ALTER TABLE "SweepstakesEntry" ADD COLUMN "landingPath" TEXT,
ADD COLUMN "prizeScope" TEXT;

-- CreateIndex
CREATE INDEX "SweepstakesEntry_landingPath_idx" ON "SweepstakesEntry"("landingPath");
