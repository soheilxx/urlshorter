/** Gemeinsamer Vertrag für Pixel und Reddit CAPI v3. */
export const REDDIT_EVENT_TYPES = ["PageVisit", "AddToCart", "OutboundClick"] as const;
export type RedditEventType = (typeof REDDIT_EVENT_TYPES)[number];

export const REDDIT_PIXEL_PATTERN = /^a2_[a-z0-9]+$/i;
export const REDDIT_IDENTIFIER_PATTERN = /^[a-zA-Z0-9._-]{1,200}$/;

export function redditEventType(type: RedditEventType) {
  switch (type) {
    case "PageVisit":
      return { tracking_type: "PAGE_VISIT" as const };
    case "AddToCart":
      return { tracking_type: "ADD_TO_CART" as const };
    case "OutboundClick":
      return { tracking_type: "CUSTOM" as const, custom_event_name: "OutboundClick" };
  }
}

export interface RedditTrackingConfig {
  pixelId: string;
  context: string;
  path: string;
  amazonUrl: string;
}
