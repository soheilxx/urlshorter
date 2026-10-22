-- Ziehungsprotokoll der Gewinnspiele (kampagnenrein). Jede gezogene Teilnahme
-- erhält genau einen Protokolleintrag (ein Los gewinnt höchstens einmal);
-- Vorzustand, Topfgröße und Zufallsindex bleiben nachvollziehbar. Additiv.
CREATE TABLE "SweepstakesDraw" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "prizeId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "entryId" TEXT NOT NULL,
    "previousStatus" "SweepstakesEntryStatus" NOT NULL,
    "poolSize" INTEGER NOT NULL,
    "randomIndex" INTEGER NOT NULL,
    "drawnBy" TEXT NOT NULL,
    "drawnAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SweepstakesDraw_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SweepstakesDraw_entryId_key" ON "SweepstakesDraw"("entryId");
CREATE UNIQUE INDEX "SweepstakesDraw_campaignId_sequence_key" ON "SweepstakesDraw"("campaignId", "sequence");
CREATE INDEX "SweepstakesDraw_campaignId_prizeId_idx" ON "SweepstakesDraw"("campaignId", "prizeId");

ALTER TABLE "SweepstakesDraw" ADD CONSTRAINT "SweepstakesDraw_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "SweepstakesEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
