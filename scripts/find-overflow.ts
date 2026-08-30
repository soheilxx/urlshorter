/** Findet Elemente, die auf /admin/amazon bei 390 px über den Viewport hinausragen. */
import { chromium } from "@playwright/test";

const BASE = "http://127.0.0.1:3100";

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(`${BASE}/admin/login`);
  await page.getByLabel("E-Mail-Adresse").fill("admin@test.local");
  await page.getByLabel("Passwort").fill("E2E-Testpasswort-123!");
  await page.getByRole("button", { name: "Anmelden" }).click();
  await page.waitForURL(/\/admin/);
  await page.goto(`${BASE}/admin/amazon`, { waitUntil: "networkidle" });
  const offenders = await page.evaluate(() => {
    const vw = window.innerWidth;
    const out: string[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>("body *"))) {
      const r = el.getBoundingClientRect();
      if (r.right > vw + 1 && r.width > 40) {
        const cls = (el.getAttribute("class") ?? "").slice(0, 90);
        out.push(`${el.tagName.toLowerCase()} right=${Math.round(r.right)} w=${Math.round(r.width)} class="${cls}"`);
      }
    }
    return out.slice(0, 20);
  });
  console.log(offenders.join("\n") || "nichts gefunden");
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
