-- Kampagnentrennung – Schritt 2: globale Eindeutigkeit der Bestellnummer
-- aufheben. Sie gilt seit Schritt 1 je Kampagne (campaignId, orderNumberHash);
-- dieselbe Bestellnummer darf bei Dubai und bei Cards je einmal registriert
-- werden. Kein Datenverlust; der Hash bleibt für die Admin-Suche indiziert.
DROP INDEX "SweepstakesEntry_orderNumberHash_key";
CREATE INDEX "SweepstakesEntry_orderNumberHash_idx" ON "SweepstakesEntry"("orderNumberHash");
