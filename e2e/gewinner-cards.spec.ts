import { execFileSync } from "node:child_process";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

/**
 * E2E: Gewinnziehung /gewinner-cards („Triple Chance“, nur Admin).
 * Legt zuvor ein Cards-Los über den echten Service an (Teilnahme ist seit dem
 * 06.10.2026 geschlossen, daher nicht über das Formular), zieht einen Gewinn mit
 * reduzierter Bewegung und prüft Enthüllung, Protokoll und Verwerfen.
 */

const STAMP = Date.now().toString().slice(-7);
const ORDER = `306-${STAMP}-7000007`;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

/** Cards-Los über den Service anlegen (Env aus .env.test, server-only-Stub via NODE_PATH). */
function seedCardsEntry(orderNumber: string, email: string): { ok: boolean } {
  const root = path.resolve(__dirname, "..");
  const out = execFileSync(
    process.execPath,
    [
      path.join(root, "node_modules/tsx/dist/cli.mjs"),
      path.join(__dirname, "seed-cards-entry.ts"),
      orderNumber,
      email,
    ],
    {
      cwd: root,
      env: { ...process.env, NODE_PATH: path.join(root, "src/tests/stubs") },
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 60_000,
    },
  );
  return JSON.parse(out.trim().split("\n").pop() ?? "{}") as { ok: boolean };
}

async function blockExternal(page: Page) {
  await page.route("**/*", (route) =>
    new URL(route.request().url()).hostname === "127.0.0.1" ? route.continue() : route.abort(),
  );
}

test.describe("Gewinnziehung /gewinner-cards", () => {
  test.use({ userAgent: UA });

  test("ohne Anmeldung keine Ziehungsseite", async ({ page }) => {
    await page.goto("/gewinner-cards");
    await expect(page).toHaveURL(/\/admin\/login/);
    await expect(page.getByText("Triple Chance")).toHaveCount(0);
  });

  test("Admin zieht ein Los: Walzen, Enthüllung mit Los-Nr. und Bestellnummer, Protokoll, Verwerfen", async ({
    page,
  }) => {
    await blockExternal(page);
    await page.emulateMedia({ reducedMotion: "reduce" });

    // Ein Cards-Los anlegen (Service mit Zeitpunkt in der Teilnahmephase)
    expect(seedCardsEntry(ORDER, "ziehung@test.local").ok).toBe(true);

    await loginAsAdmin(page);
    await page.goto("/gewinner-cards");
    await expect(page.getByRole("heading", { level: 1, name: "Triple Chance" })).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    const poolBefore = Number((await page.getByTestId("tc-pool").innerText()).replace(/\D/g, ""));
    expect(poolBefore).toBeGreaterThanOrEqual(1);
    const drawnBefore = Number(
      (await page.getByTestId("tc-drawn").innerText()).replace(/GEZOGEN\s+/, "").split("/")[0],
    );
    await expect(page.getByTestId("tc-drawn")).toContainText("/17");

    // Kategorie wählen und ziehen
    await page.getByTestId("tc-prize-cardmarket_100").click();
    await expect(page.getByTestId("tc-start")).toBeEnabled();
    await page.getByTestId("tc-start").click();

    // Enthüllung: Los-Nr. (8 Zeichen), Bestellnummer, Gewinn – keine Namen
    const winner = page.getByTestId("tc-winner");
    await expect(winner).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("tc-winner-name")).toHaveText("Ziehung T.");
    await expect(page.getByTestId("tc-winner-los")).toHaveText(/^[2-9A-HJKMNP-Z]{8}$/);
    await expect(page.getByTestId("tc-winner-order")).toContainText("Bestellnummer 306-");
    await expect(page.getByTestId("tc-winner-prize")).toHaveText(
      "Wertgutschein für cardmarket.pro über 100 €",
    );
    expect(await winner.innerText()).not.toMatch(/Ziehung Test|ziehung@test\.local|Losweg/);
    // Alle drei Walzen zeigen das Gewinner-Los in der Mittelreihe
    const los = await page.getByTestId("tc-winner-los").innerText();
    for (const i of [0, 1, 2]) {
      await expect(page.getByTestId(`tc-reel-${i}`).locator('[data-winner="1"]')).toContainText(
        los,
      );
    }

    await page.waitForTimeout(700);
    await page.screenshot({
      path: "test-results/screenshots/gewinner-cards-reveal-1440.png",
      fullPage: false,
    });
    await page.getByTestId("tc-close").click();
    await expect(winner).toHaveCount(0);
    await expect(page.getByTestId("tc-drawn")).toContainText(
      `GEZOGEN ${String(drawnBefore + 1).padStart(2, "0")}/17`,
    );
    const row = page.getByTestId("tc-protocol").locator("tbody tr").first();
    await expect(row).toContainText(los);
    await expect(row).toContainText("Wertgutschein für cardmarket.pro über 100 €");
    await expect(row).toContainText("admin@test.local");
    await expect(row).toContainText("Ziehung T.");
    await expect(page.getByTestId("tc-wall-won").first()).toContainText("Ziehung T.");

    // Im Admin ist das Los als Gewinner mit Gewinn sichtbar
    await page.goto(`/admin/gewinnspiel?campaign=cards_2026&status=WINNER&ref=${los}`);
    await expect(page.locator("tbody tr").first()).toContainText("Gewinner");

    // Verwerfen: Los zurück in den Topf
    await page.goto("/gewinner-cards");
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByTestId("tc-undo").click();
    await expect(page.getByText(/Ziehung verworfen – Los/)).toBeVisible();
    await expect(page.getByTestId("tc-drawn")).toContainText(
      `GEZOGEN ${String(drawnBefore).padStart(2, "0")}/17`,
    );

    // Erneut ziehen und komplett zurücksetzen (Eingabe ZURÜCKSETZEN)
    await page.getByTestId("tc-prize-cardmarket_100").click();
    await page.getByTestId("tc-start").click();
    await expect(page.getByTestId("tc-winner")).toBeVisible({ timeout: 20_000 });
    await page.getByTestId("tc-close").click();
    page.once("dialog", (dialog) => dialog.accept("ZURÜCKSETZEN"));
    await page.getByTestId("tc-reset").click();
    await expect(page.getByTestId("tc-message")).toContainText("zurückgesetzt");
    await expect(page.getByTestId("tc-drawn")).toContainText("GEZOGEN 00/17");
    await expect(page.getByTestId("tc-wall-won")).toHaveCount(0);

    // Bühne verrät nichts über ausgeschlossene Lose (Stream!)
    expect(await page.locator("main").innerText()).not.toMatch(/ausgeschlossen|Testeintrag/i);

    // Los ausschließen und wieder aufnehmen – auf der getrennten Verwaltungsseite
    await page.getByTestId("tc-lots-link").click();
    await expect(page).toHaveURL(/\/gewinner-cards\/lose$/);
    const lotRow = page.getByTestId(`lot-${los}`);
    page.once("dialog", (dialog) => dialog.accept());
    await lotRow.getByTestId("lot-exclude").click();
    await expect(page.getByTestId("lots-excluded")).toHaveText("1");
    await expect(lotRow).toContainText("ausgeschlossen");
    await page.goto("/gewinner-cards");
    await expect(page.getByTestId("tc-pool")).toContainText("LOSE IM TOPF 0000");
    expect(await page.locator("main").innerText()).not.toMatch(/ausgeschlossen|Testeintrag/i);
    await page.goto("/gewinner-cards/lose");
    await page.getByTestId(`lot-${los}`).getByRole("button", { name: "Wieder aufnehmen" }).click();
    await expect(page.getByTestId("lots-excluded")).toHaveText("0");
    await page.goto("/gewinner-cards");
    await page.screenshot({
      path: "test-results/screenshots/gewinner-cards-1440.png",
      fullPage: true,
    });
  });
});
