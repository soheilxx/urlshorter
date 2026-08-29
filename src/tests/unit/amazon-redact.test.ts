import { describe, expect, it } from "vitest";
import { redactJson, redactSecrets, safeErrorMessage } from "@/lib/amazon/redact";

describe("redactSecrets", () => {
  it("entfernt api_key-Parameter aus URLs", () => {
    const input = "https://api.rainforestapi.com/request?type=product&api_key=GEHEIM123&asin=X";
    const result = redactSecrets(input);
    expect(result).not.toContain("GEHEIM123");
    expect(result).toContain("api_key=REDACTED");
    expect(result).toContain("type=product"); // Rest bleibt lesbar
  });

  it("entfernt Bearer-Tokens und JSON-Secrets", () => {
    expect(redactSecrets("Authorization: Bearer abc.def-123")).toBe(
      "Authorization: Bearer REDACTED",
    );
    expect(redactSecrets('{"client_secret":"topsecret"}')).toBe('{"client_secret":"REDACTED"}');
    expect(redactSecrets('{"access_token":"tok"}')).toBe('{"access_token":"REDACTED"}');
  });
});

describe("safeErrorMessage", () => {
  it("redigiert und begrenzt Fehlermeldungen", () => {
    const error = new Error(
      `Request failed: https://api.rainforestapi.com/account?api_key=SUPERSECRET ${"x".repeat(500)}`,
    );
    const message = safeErrorMessage(error);
    expect(message).not.toContain("SUPERSECRET");
    expect(message.length).toBeLessThanOrEqual(300);
  });
});

describe("redactJson", () => {
  it("entfernt Secret-Felder rekursiv und bereinigt URL-Strings", () => {
    const payload = {
      request_metadata: {
        amazon_url: "https://www.amazon.de/dp/X?api_key=LEAK",
      },
      account_info: { api_key: "LEAK2", email: "someone@example.com", plan: "starter" },
      nested: [{ authorization: "Bearer abc" }],
    };
    const result = JSON.stringify(redactJson(payload));
    expect(result).not.toContain("LEAK");
    expect(result).not.toContain("someone@example.com");
    expect(result).toContain("starter");
    expect(result).toContain("REDACTED");
  });
});
