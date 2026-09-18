-- Kampagnentrennung der Buch-Gewinnspiele (Dubai vs. Cards) – Schritt 1 (additiv).
--
-- 1) Kampagnenkennung je Teilnahme. Alle bereits vorhandenen Teilnahmen
--    stammen aus den Dubai-Wegen (/gewinn, /verlosung bzw. Alt-Teilnahmen vor
--    Einführung von landingPath) und werden ausdrücklich der Dubai-Kampagne
--    zugeordnet. Der DB-Default sichert alte Instanzen während des Rollouts
--    (sie bedienen ausschließlich Dubai-Wege); die neuen Schreibpfade setzen
--    die Kampagne immer explizit (kein Fallback im Anwendungscode).
ALTER TABLE "SweepstakesEntry" ADD COLUMN "campaignId" TEXT NOT NULL DEFAULT 'dubai_2026';
UPDATE "SweepstakesEntry" SET "campaignId" = 'dubai_2026';

-- 2) Gewinnzuordnung (Katalog der jeweiligen Kampagne, nur Status WINNER).
ALTER TABLE "SweepstakesEntry" ADD COLUMN "prizeId" TEXT;

-- 3) Neue Eindeutigkeit: eine Bestellnummer je Kampagne genau einmal.
--    Der alte globale Unique-Index bleibt in diesem Schritt bestehen und wird
--    erst in der Folgemigration entfernt (neue Eindeutigkeit zuerst wirksam).
CREATE INDEX "SweepstakesEntry_campaignId_idx" ON "SweepstakesEntry"("campaignId");
CREATE UNIQUE INDEX "SweepstakesEntry_campaignId_orderNumberHash_key" ON "SweepstakesEntry"("campaignId", "orderNumberHash");
