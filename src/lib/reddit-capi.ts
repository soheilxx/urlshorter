import "server-only";
import { isIP } from "node:net";
import { logger } from "@/lib/logger";
import {
  REDDIT_IDENTIFIER_PATTERN,
  REDDIT_PIXEL_PATTERN,
  redditEventType,
  type RedditEventType,
} from "@/lib/reddit-events";

export interface RedditCapiInput {
  pixelId: string;
  accessToken: string;
  testId?: string | null;
  events: Array<{ id: string; type: RedditEventType; timestamp: number }>;
  sourceUrl: string;
  clickId?: string | null;
  uuid?: string | null;
  clientIp: string | null;
  clientUserAgent: string | null;
}

function identifier(value: string | null | undefined): string | undefined {
  return value && REDDIT_IDENTIFIER_PATTERN.test(value) ? value : undefined;
}

/** Kein Umsatz: AddToCart bezeichnet hier den ausdrücklich gewünschten Amazon-Klick-Proxy. */
export function buildRedditCapiPayload(input: RedditCapiInput) {
  const url = new URL(input.sourceUrl);
  url.search = "";
  url.hash = "";
  url.username = "";
  url.password = "";
  if (!/^https?:$/.test(url.protocol)) throw new Error("Invalid Reddit source URL");

  const user = {
    ...(input.clientIp && isIP(input.clientIp) ? { ip_address: input.clientIp } : {}),
    ...(input.clientUserAgent ? { user_agent: input.clientUserAgent.slice(0, 500) } : {}),
    ...(identifier(input.uuid) ? { uuid: identifier(input.uuid) } : {}),
  };
  return {
    data: {
      ...(input.testId ? { test_id: input.testId } : {}),
      events: input.events.map((event) => ({
        event_at: event.timestamp,
        action_source: "WEBSITE" as const,
        event_source_url: url.toString(),
        type: redditEventType(event.type),
        metadata: { conversion_id: event.id },
        ...(identifier(input.clickId) ? { click_id: identifier(input.clickId) } : {}),
        user,
      })),
    },
  };
}

/** Begrenzter Versand nach der Response; keine Tokens, IPs oder Anbieterantworten loggen. */
export async function sendRedditCapiEvents(input: RedditCapiInput): Promise<boolean> {
  if (!REDDIT_PIXEL_PATTERN.test(input.pixelId) || !input.accessToken || !input.events.length) {
    return false;
  }
  const eventIds = input.events.map((event) => event.id);
  try {
    const payload = JSON.stringify(buildRedditCapiPayload(input));
    for (let attempt = 0; attempt < 2; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3_000);
      try {
        const response = await fetch(
          `https://ads-api.reddit.com/api/v3/pixels/${encodeURIComponent(input.pixelId)}/conversion_events`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${input.accessToken}`,
            },
            body: payload,
            signal: controller.signal,
            redirect: "error",
          },
        );
        if (response.ok) {
          // Reddit v3 bestätigt Annahme mit data.message. Kein Erfolg bei unerwarteten Antworten.
          const result = (await response.json()) as {
            data?: { message?: unknown };
            error?: unknown;
          };
          if (!result.error && typeof result.data?.message === "string") {
            logger.info("reddit_capi.sent", { eventIds, test: Boolean(input.testId) });
            return true;
          }
          logger.error("reddit_capi.invalid_response", { eventIds });
          return false;
        }
        const retryable = response.status === 429 || response.status >= 500;
        if (!retryable || attempt === 1) {
          logger.error("reddit_capi.send_failed", { eventIds, status: response.status });
          return false;
        }
        const retryAfter = Number(response.headers.get("retry-after"));
        // Lange Anbieter-Wartezeiten nicht innerhalb einer Serverless-Response übergehen.
        if (Number.isFinite(retryAfter) && retryAfter > 1) {
          logger.warn("reddit_capi.retry_skipped", { eventIds, status: response.status });
          return false;
        }
      } catch {
        if (attempt === 1) {
          logger.error("reddit_capi.request_error", { eventIds });
          return false;
        }
      } finally {
        clearTimeout(timeout);
      }
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
  } catch {
    logger.error("reddit_capi.invalid_payload", { eventIds });
  }
  return false;
}
