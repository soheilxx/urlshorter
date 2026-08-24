/**
 * Heuristische Bot-Erkennung für die Redirect-Route.
 * Bots werden erfasst, aber getrennt gespeichert und in den
 * Standardstatistiken ausgeschlossen.
 */

export interface BotClassification {
  isBot: boolean;
  reason: string | null;
}

const BOT_UA_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  {
    pattern: /googlebot|adsbot-google|mediapartners-google|google-inspectiontool/i,
    label: "google-crawler",
  },
  { pattern: /bingbot|bingpreview|msnbot/i, label: "bing-crawler" },
  { pattern: /facebookexternalhit|facebookcatalog|meta-externalagent/i, label: "meta-preview" },
  { pattern: /whatsapp/i, label: "whatsapp-preview" },
  { pattern: /telegrambot/i, label: "telegram-preview" },
  { pattern: /slackbot|slack-imgproxy/i, label: "slack-preview" },
  { pattern: /twitterbot/i, label: "twitter-preview" },
  { pattern: /discordbot/i, label: "discord-preview" },
  { pattern: /linkedinbot/i, label: "linkedin-preview" },
  { pattern: /pinterestbot|pinterest\/0\./i, label: "pinterest-crawler" },
  { pattern: /skypeuripreview/i, label: "skype-preview" },
  { pattern: /applebot/i, label: "apple-crawler" },
  { pattern: /duckduckbot|duckduckgo/i, label: "duckduckgo-crawler" },
  { pattern: /yandex(bot|images|metrika)/i, label: "yandex-crawler" },
  { pattern: /baiduspider/i, label: "baidu-crawler" },
  {
    pattern:
      /gptbot|oai-searchbot|chatgpt-user|claudebot|claude-web|anthropic-ai|perplexitybot|ccbot|bytespider|amazonbot|petalbot/i,
    label: "ai-crawler",
  },
  {
    pattern: /semrushbot|ahrefsbot|mj12bot|dotbot|rogerbot|screaming frog|seokicks|sistrix/i,
    label: "seo-crawler",
  },
  {
    pattern: /uptimerobot|pingdom|statuscake|site24x7|newrelicpinger|checkly/i,
    label: "uptime-monitor",
  },
  {
    pattern: /headlesschrome|phantomjs|puppeteer|playwright|selenium|electron/i,
    label: "headless-browser",
  },
  { pattern: /lighthouse|pagespeed|gtmetrix|ptst/i, label: "performance-tool" },
  {
    pattern:
      /curl\/|wget\/|python-requests|python-urllib|aiohttp|httpx|okhttp|go-http-client|java\/|libwww|scrapy|node-fetch|axios\/|got \(|guzzlehttp/i,
    label: "http-client",
  },
  { pattern: /vercel-screenshot|vercelbot/i, label: "vercel-bot" },
  // Generischer Fallback – bewusst zuletzt, damit spezifische Labels gewinnen
  { pattern: /\b(bot|crawler|spider|crawling|scraper)\b/i, label: "generic-bot-keyword" },
];

export interface ClassifyRequestInput {
  method: string;
  userAgent: string | null;
  /** Header "purpose" bzw. "sec-purpose" (Prefetch/Preview-Erkennung) */
  purposeHeader?: string | null;
  secPurposeHeader?: string | null;
}

export function classifyRequest(input: ClassifyRequestInput): BotClassification {
  const method = (input.method ?? "GET").toUpperCase();
  if (method === "HEAD") {
    return { isBot: true, reason: "head-request" };
  }

  const purpose = `${input.purposeHeader ?? ""} ${input.secPurposeHeader ?? ""}`.toLowerCase();
  if (
    purpose.includes("prefetch") ||
    purpose.includes("prerender") ||
    purpose.includes("preview")
  ) {
    return { isBot: true, reason: "prefetch-or-preview" };
  }

  const ua = input.userAgent?.trim() ?? "";
  if (ua.length === 0) {
    return { isBot: true, reason: "missing-user-agent" };
  }

  for (const { pattern, label } of BOT_UA_PATTERNS) {
    if (pattern.test(ua)) {
      return { isBot: true, reason: `ua-pattern:${label}` };
    }
  }

  return { isBot: false, reason: null };
}
