import { describe, expect, it } from "vitest";
import { isBookPurchaseUrl } from "@/lib/book-conversion-events";

describe("bekannte Kaufziele des Buchs", () => {
  it.each([
    "https://link.amazon/B0eyhvaQw",
    "https://link.amazon/B0eyhvaQw?tag=wiresoft0c-21#details",
    "https://www.amazon.de/dp/3690662508",
    "https://www.amazon.de/Die-Lizenz-zum-Erfolg/dp/3690662508/ref=book?tag=test",
    "https://amazon.de/gp/product/3690662508?ref=ad",
    "https://www.amazon.com/dp/3690662508/",
    "https://www.thalia.de/shop/home/artikeldetails/A1081265220?utm_source=book",
    "https://www.buecher.de/shop/home/artikeldetails/A1081265220/",
    "https://www.hugendubel.de/de/buch_kartoniert/soheil_hosseini-die_lizenz_zum_erfolg-54366155-produkt-details.html",
  ])("erkennt die bekannte Produktidentität: %s", (url) => {
    expect(isBookPurchaseUrl(url)).toBe(true);
  });

  it.each([
    "https://lizenzzumerfolg.com/das-buch",
    "https://soheil-hosseini.de/die-lizenz-zum-erfolg/",
    "https://lizenzzumerfolg.com/buch-reddit#buch",
    "https://www.amazon.de/",
    "https://www.amazon.de/dp/OTHERBOOK1?asin=3690662508",
    "https://www.amazon.de/dp/36906625080",
    "https://www.amazon.de/s?k=3690662508",
    "https://www.thalia.de/shop/home/artikeldetails/A9999999999?isbn=9783690662505",
    "https://www.amazon.de.evil.example/dp/3690662508",
    "https://www.amazon.de@evil.example/dp/3690662508",
    "https://user:password@www.amazon.de/dp/3690662508",
    "https://www.amazon.de:8443/dp/3690662508",
    "https://link.amazon/other?next=B0eyhvaQw",
    "https://amzn.to/unverified",
    "http://www.amazon.de/dp/3690662508",
    "javascript:alert(1)",
    "/das-buch",
    "#buch",
  ])("zählt Navigation, andere Produkte und manipulierte Ziele nicht: %s", (url) => {
    expect(isBookPurchaseUrl(url)).toBe(false);
  });
});
