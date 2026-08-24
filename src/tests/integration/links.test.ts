import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { generateUniqueShortCode, SHORT_CODE_PATTERN } from "@/lib/shortcode";
import { validateDestinationUrl } from "@/lib/url-validation";
import { DEFAULT_ALLOWED_HOSTS } from "@/lib/url-validation";
import { createTestDestination, createTestLink, truncateAll } from "./helpers";

describe("Kurzlinks und Destinations (Datenbank)", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  it("der Unique Constraint verhindert doppelte Codes", async () => {
    const dest = await createTestDestination();
    await createTestLink(dest.id, { code: "abcd" });

    await expect(createTestLink(dest.id, { code: "abcd" })).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002",
    );
  });

  it("generateUniqueShortCode weicht real belegten Codes aus", async () => {
    const dest = await createTestDestination();
    const existing = await createTestLink(dest.id, { code: "abcd" });

    const isTaken = async (code: string) => (await prisma.shortLink.count({ where: { code } })) > 0;

    for (let i = 0; i < 20; i++) {
      const code = await generateUniqueShortCode(isTaken);
      expect(code).toMatch(SHORT_CODE_PATTERN);
      expect(code).not.toBe(existing.code);
    }
  });

  it("mehrere Kurzlinks können auf dieselbe Destination zeigen", async () => {
    const dest = await createTestDestination();
    await createTestLink(dest.id, { code: "aaaa", source: "Instagram" });
    await createTestLink(dest.id, { code: "bbbb", source: "Newsletter" });
    await createTestLink(dest.id, { code: "cccc", source: "Plakat Berlin" });

    const withLinks = await prisma.destination.findUniqueOrThrow({
      where: { id: dest.id },
      include: { shortLinks: true },
    });
    expect(withLinks.shortLinks).toHaveLength(3);
    const sources = withLinks.shortLinks.map((l) => l.source).sort();
    expect(sources).toEqual(["Instagram", "Newsletter", "Plakat Berlin"]);
  });

  it("eine Destination mit ungültiger URL wird bereits durch die Validierung abgelehnt", () => {
    expect(
      validateDestinationUrl("https://amazon.de.example.com/x", DEFAULT_ALLOWED_HOSTS).ok,
    ).toBe(false);
    expect(validateDestinationUrl("http://www.amazon.de/x", DEFAULT_ALLOWED_HOSTS).ok).toBe(false);
  });

  it("eine Destination mit verknüpften Links kann nicht gelöscht werden (Restrict)", async () => {
    const dest = await createTestDestination();
    await createTestLink(dest.id, { code: "abcd" });
    await expect(prisma.destination.delete({ where: { id: dest.id } })).rejects.toThrow();
  });
});
