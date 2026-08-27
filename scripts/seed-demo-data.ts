import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

/**
 * Befüllt die LOKALE Entwicklungs-Datenbank mit realistischen Demo-Daten
 * (Kurzlinks + Klick-Events über 30 Tage, inkl. Geo-Koordinaten und Kanälen),
 * damit Dashboard und Analytics-Karte lokal etwas anzeigen.
 *
 * Sicherheitsabbruch, wenn DATABASE_URL nicht auf eine lokale
 * Entwicklungs-/Test-Datenbank zeigt. Niemals gegen Produktion ausführen.
 *
 * Aufruf: npm run seed:demo
 */

const CITIES: Array<{
  city: string;
  country: string;
  lat: number;
  lng: number;
  weight: number;
}> = [
  { city: "Berlin", country: "DE", lat: 52.5, lng: 13.4, weight: 18 },
  { city: "Hamburg", country: "DE", lat: 53.6, lng: 10.0, weight: 12 },
  { city: "Munich", country: "DE", lat: 48.1, lng: 11.6, weight: 12 },
  { city: "Cologne", country: "DE", lat: 50.9, lng: 6.9, weight: 9 },
  { city: "Frankfurt am Main", country: "DE", lat: 50.1, lng: 8.7, weight: 8 },
  { city: "Stuttgart", country: "DE", lat: 48.8, lng: 9.2, weight: 6 },
  { city: "Leipzig", country: "DE", lat: 51.3, lng: 12.4, weight: 5 },
  { city: "Vienna", country: "AT", lat: 48.2, lng: 16.4, weight: 7 },
  { city: "Graz", country: "AT", lat: 47.1, lng: 15.4, weight: 2 },
  { city: "Zurich", country: "CH", lat: 47.4, lng: 8.5, weight: 6 },
  { city: "Basel", country: "CH", lat: 47.6, lng: 7.6, weight: 2 },
  { city: "Amsterdam", country: "NL", lat: 52.4, lng: 4.9, weight: 4 },
  { city: "Paris", country: "FR", lat: 48.9, lng: 2.4, weight: 4 },
  { city: "London", country: "GB", lat: 51.5, lng: -0.1, weight: 5 },
  { city: "Madrid", country: "ES", lat: 40.4, lng: -3.7, weight: 3 },
  { city: "Rome", country: "IT", lat: 41.9, lng: 12.5, weight: 3 },
  { city: "Warsaw", country: "PL", lat: 52.2, lng: 21.0, weight: 3 },
  { city: "Copenhagen", country: "DK", lat: 55.7, lng: 12.6, weight: 2 },
  { city: "Stockholm", country: "SE", lat: 59.3, lng: 18.1, weight: 2 },
  { city: "New York", country: "US", lat: 40.7, lng: -74.0, weight: 5 },
  { city: "Los Angeles", country: "US", lat: 34.1, lng: -118.2, weight: 3 },
  { city: "Chicago", country: "US", lat: 41.9, lng: -87.6, weight: 2 },
  { city: "Toronto", country: "CA", lat: 43.7, lng: -79.4, weight: 2 },
  { city: "Sao Paulo", country: "BR", lat: -23.6, lng: -46.6, weight: 2 },
  { city: "Sydney", country: "AU", lat: -33.9, lng: 151.2, weight: 2 },
  { city: "Tokyo", country: "JP", lat: 35.7, lng: 139.7, weight: 2 },
  { city: "Singapore", country: "SG", lat: 1.3, lng: 103.9, weight: 2 },
  { city: "Dubai", country: "AE", lat: 25.3, lng: 55.3, weight: 2 },
  { city: "Cape Town", country: "ZA", lat: -33.9, lng: 18.4, weight: 1 },
  { city: "Mumbai", country: "IN", lat: 19.1, lng: 72.9, weight: 2 },
];

const LINKS: Array<{
  name: string;
  source: string;
  medium: string | null;
  campaign: string | null;
  referrers: Array<string | null>;
  utm?: { source: string; medium: string } | null;
}> = [
  {
    name: "Instagram Bio",
    source: "instagram",
    medium: "social",
    campaign: "buchlaunch",
    referrers: ["https://l.instagram.com/", null],
  },
  {
    name: "Facebook Gruppe",
    source: "facebook",
    medium: "social",
    campaign: "buchlaunch",
    referrers: ["https://m.facebook.com/", "https://lm.facebook.com/l.php", null],
  },
  {
    name: "TikTok Profil",
    source: "tiktok",
    medium: "social",
    campaign: null,
    referrers: ["https://www.tiktok.com/", null],
  },
  {
    name: "LinkedIn Post",
    source: "linkedin",
    medium: "social",
    campaign: "b2b",
    referrers: ["https://www.linkedin.com/", null],
  },
  {
    name: "Meta Ads Kampagne",
    source: "facebook",
    medium: "cpc",
    campaign: "ads-q3",
    referrers: ["https://l.facebook.com/", null],
    utm: { source: "facebook", medium: "paid_social" },
  },
  {
    name: "Newsletter August",
    source: "newsletter",
    medium: "email",
    campaign: "nl-2026-08",
    referrers: [null],
    utm: { source: "newsletter", medium: "email" },
  },
  {
    name: "Google Suche (Bio-Link)",
    source: "google",
    medium: "organic",
    campaign: null,
    referrers: ["https://www.google.com/", "https://www.google.de/"],
  },
  {
    name: "QR-Code Flyer",
    source: "qr-flyer",
    medium: null,
    campaign: "messe",
    referrers: [null],
  },
  {
    name: "Blog-Artikel Partner",
    source: "partnerblog",
    medium: "referral",
    campaign: null,
    referrers: ["https://buchtipps-blog.de/artikel/lizenz-zum-erfolg"],
  },
];

const DEVICES = [
  { deviceType: "mobile", browser: "Mobile Safari", os: "iOS", weight: 4 },
  { deviceType: "mobile", browser: "Chrome", os: "Android", weight: 4 },
  { deviceType: "desktop", browser: "Chrome", os: "Windows", weight: 3 },
  { deviceType: "desktop", browser: "Safari", os: "macOS", weight: 1 },
  { deviceType: "tablet", browser: "Safari", os: "iPadOS", weight: 1 },
];

function pickWeighted<T extends { weight: number }>(items: T[]): T {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let r = Math.random() * total;
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item;
  }
  return items[items.length - 1] as T;
}

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)] as T;
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL ?? "";
  if (!/urlshorter_(dev|test)/.test(url) || !/(localhost|127\.0\.0\.1)/.test(url)) {
    throw new Error(
      "Sicherheitsabbruch: DATABASE_URL zeigt nicht auf eine lokale urlshorter_dev/_test-Datenbank.",
    );
  }

  const prisma = new PrismaClient();
  try {
    const destination = await prisma.destination.upsert({
      where: { id: "demo-destination" },
      update: {},
      create: {
        id: "demo-destination",
        name: "Amazon Buchseite (Demo)",
        url: "https://www.amazon.de/dp/B0DEMO1234",
        host: "www.amazon.de",
      },
    });

    const codes = "abcdefghijklmnopqrstuvwxyz";
    const links = [];
    for (let i = 0; i < LINKS.length; i++) {
      const def = LINKS[i]!;
      const code = `dm${codes[Math.floor(i / 26) % 26]}${codes[i % 26]}`;
      const link = await prisma.shortLink.upsert({
        where: { code },
        update: {},
        create: {
          code,
          name: def.name,
          source: def.source,
          medium: def.medium,
          campaign: def.campaign,
          destinationId: destination.id,
        },
      });
      links.push({ link, def });
    }

    const events = [];
    const now = Date.now();
    const totalEvents = 1400;
    for (let i = 0; i < totalEvents; i++) {
      const { link, def } = pick(links);
      const city = pickWeighted(CITIES);
      const device = pickWeighted(DEVICES);

      // Zeitverlauf: 30 Tage, mit Abend-Peaks und mehr Traffic an jüngeren Tagen
      const daysAgo = Math.floor(Math.pow(Math.random(), 1.6) * 30);
      const hour = pickWeighted([
        { h: 8, weight: 1 },
        { h: 10, weight: 2 },
        { h: 12, weight: 2 },
        { h: 15, weight: 2 },
        { h: 18, weight: 3 },
        { h: 20, weight: 4 },
        { h: 22, weight: 2 },
      ]).h;
      const ts = new Date(
        now -
          daysAgo * 86_400_000 -
          (23 - hour) * 3_600_000 -
          Math.floor(Math.random() * 3_600_000),
      );
      if (ts.getTime() > now) continue;

      const isBot = Math.random() < 0.12;
      const referrer = pick(def.referrers);
      const jitter = () => Math.round((Math.random() - 0.5) * 2) / 10;

      events.push({
        id: randomUUID(),
        shortLinkId: link.id,
        code: link.code,
        destinationId: destination.id,
        ts,
        linkName: link.name,
        source: link.source,
        medium: link.medium,
        campaign: link.campaign,
        content: null,
        referrer,
        utmSource: def.utm?.source ?? null,
        utmMedium: def.utm?.medium ?? null,
        deviceType: isBot ? null : device.deviceType,
        browser: isBot ? null : device.browser,
        os: isBot ? null : device.os,
        country: city.country,
        region: null,
        city: isBot ? null : city.city,
        latitude: isBot ? null : Math.round((city.lat + jitter()) * 10) / 10,
        longitude: isBot ? null : Math.round((city.lng + jitter()) * 10) / 10,
        isBot,
        botReason: isBot ? "ua_pattern" : null,
        visitorHash: isBot
          ? null
          : `demo-${Math.floor(Math.random() * 420)
              .toString(16)
              .padStart(4, "0")}`,
        consent: !isBot && Math.random() < 0.7,
        bridgeLoaded: !isBot && Math.random() < 0.93,
        trackingFired: !isBot && Math.random() < 0.85,
        redirectStarted: !isBot && Math.random() < 0.95,
      });
    }

    await prisma.clickEvent.createMany({ data: events });
    console.log(
      `Demo-Daten angelegt: 1 Ziel, ${links.length} Kurzlinks, ${events.length} Klick-Events.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
