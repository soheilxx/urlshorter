import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

/**
 * Ergänzt die lokale Dev-/Test-DB um EXTREME Labels (lange Namen, Kampagnen
 * mit Pipes, unzerbrechliche Referrer-URLs), um Mobile-Layout-Fehler zu
 * reproduzieren, die nur mit produktionsähnlichen Daten auftreten.
 * Aufruf: npx tsx --env-file=.env scripts/seed-extreme-labels.ts
 */

const prisma = new PrismaClient();

async function main() {
  const dbUrl = process.env.DATABASE_URL ?? "";
  if (!/localhost|127\.0\.0\.1/.test(dbUrl)) {
    throw new Error("Sicherheitsabbruch: DATABASE_URL ist nicht lokal.");
  }

  const destination = await prisma.destination.upsert({
    where: { id: "seed-extreme-dest" },
    update: {},
    create: {
      id: "seed-extreme-dest",
      name: "Amazon Buchseite – Die Lizenz zum Erfolg (Taschenbuch, Sonderaktion)",
      url: "https://www.amazon.de/dp/3690662508?tag=wiresoft-21&linkCode=ogi&th=1&psc=1",
      host: "www.amazon.de",
      active: true,
    },
  });

  const link = await prisma.shortLink.upsert({
    where: { code: "xtrm" },
    update: {},
    create: {
      code: "xtrm",
      name: "Max | Buchverkauf | Lizenz zum Erfolg – Ultimative Kampagnenbezeichnung",
      source: "BH24 Newsletter Produkt Spezialaussendung",
      medium: "email",
      campaign: "Link zum Buch Insta Profil – Ultimative-Kampagnen-Bezeichnung-Q3-2026",
      destinationId: destination.id,
    },
  });

  const now = Date.now();
  const rows = Array.from({ length: 60 }, (_, i) => ({
    id: randomUUID(),
    shortLinkId: link.id,
    destinationId: destination.id,
    code: link.code,
    linkName: link.name,
    source: link.source,
    medium: link.medium,
    campaign: link.campaign,
    ts: new Date(now - i * 47 * 60 * 1000),
    referrer:
      "https://l.instagram.com/?u=https%3A%2F%2Flizenzzumerfolg.com%2Fxtrem%3Futm_source%3Dinstagram%26utm_campaign%3Dultimative-kampagne&e=AT2kXanH9",
    deviceType: i % 3 === 0 ? "desktop" : "mobile",
    browser: "Chrome",
    os: i % 2 === 0 ? "Android" : "Windows",
    country: "DE",
    city: i % 4 === 0 ? "Frankfurt am Main" : "Berlin",
    latitude: 52.5,
    longitude: 13.4,
    isBot: false,
    bridgeLoaded: true,
    trackingFired: true,
    redirectStarted: true,
  }));
  await prisma.clickEvent.createMany({ data: rows });
  console.log(`Extreme Labels geseedet: Link /${link.code} + ${rows.length} Klicks`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
