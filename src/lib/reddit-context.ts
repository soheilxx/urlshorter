import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { getEnv, requireAppSecret } from "@/lib/env";
import { AMAZON_PRODUCT_URL } from "@/lib/gewinnspiel-config";
import { REDDIT_PIXEL_PATTERN, type RedditTrackingConfig } from "@/lib/reddit-events";
import type { ConsentMode } from "@/lib/consent";

const contextSchema = z.object({
  path: z.enum(["/", "/das-buch", "/gutschein", "/gewinn", "/buch-reddit"]),
  pixelId: z.string().regex(REDDIT_PIXEL_PATTERN),
  consentMode: z.enum(["required", "not-required"]),
  expires: z.number().int(),
});

type TrackingPath = z.infer<typeof contextSchema>["path"];

function sign(payload: string): Buffer {
  return createHmac("sha256", requireAppSecret()).update(`reddit-context.v1.${payload}`).digest();
}

/** Signierte Servervorgabe: Der Browser kann Route, Pixel und Consent-Modus nicht verändern. */
export function createRedditTrackingConfig(
  path: TrackingPath,
  consentMode: ConsentMode,
): RedditTrackingConfig | null {
  const env = getEnv();
  if (!env.REDDIT_PIXEL_ID || !REDDIT_PIXEL_PATTERN.test(env.REDDIT_PIXEL_ID)) return null;
  try {
    const payload = Buffer.from(
      JSON.stringify({
        path,
        pixelId: env.REDDIT_PIXEL_ID,
        consentMode,
        expires: Date.now() + 24 * 60 * 60 * 1000,
      }),
    ).toString("base64url");
    return {
      pixelId: env.REDDIT_PIXEL_ID,
      path,
      amazonUrl: AMAZON_PRODUCT_URL,
      context: `${payload}.${sign(payload).toString("base64url")}`,
    };
  } catch {
    return null;
  }
}

export function verifyRedditContext(token: string, now = Date.now()) {
  try {
    if (token.length > 1_024) return null;
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [payload, signature] = parts as [string, string];
    const actual = Buffer.from(signature, "base64url");
    const expected = sign(payload);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
    const parsed = contextSchema.safeParse(
      JSON.parse(Buffer.from(payload, "base64url").toString()),
    );
    if (!parsed.success || parsed.data.expires <= now) return null;
    if (parsed.data.pixelId !== getEnv().REDDIT_PIXEL_ID) return null;
    return parsed.data;
  } catch {
    return null;
  }
}
