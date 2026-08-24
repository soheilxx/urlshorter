/**
 * Leichtgewichtiger User-Agent-Parser (nur die für die Statistik nötigen
 * Kategorien, keine externe Abhängigkeit, keine Lizenzrisiken).
 */

export type DeviceType = "mobile" | "tablet" | "desktop" | "unknown";

export interface ParsedUserAgent {
  deviceType: DeviceType;
  browser: string;
  os: string;
}

export function parseUserAgent(ua: string | null): ParsedUserAgent {
  if (!ua || ua.trim().length === 0) {
    return { deviceType: "unknown", browser: "Unbekannt", os: "Unbekannt" };
  }

  // Betriebssystem – Reihenfolge ist relevant (iOS vor macOS, Android vor Linux)
  let os = "Sonstiges";
  if (/iphone|ipod/i.test(ua)) os = "iOS";
  else if (/ipad/i.test(ua)) os = "iPadOS";
  else if (/android/i.test(ua)) os = "Android";
  else if (/windows nt/i.test(ua)) os = "Windows";
  else if (/macintosh|mac os x/i.test(ua)) os = "macOS";
  else if (/cros/i.test(ua)) os = "ChromeOS";
  else if (/linux/i.test(ua)) os = "Linux";

  // Gerätetyp
  let deviceType: DeviceType = "desktop";
  if (/ipad/i.test(ua) || (/android/i.test(ua) && !/mobile/i.test(ua)) || /tablet/i.test(ua)) {
    deviceType = "tablet";
  } else if (/mobi|iphone|ipod|windows phone/i.test(ua)) {
    deviceType = "mobile";
  }

  // Browser – Reihenfolge ist relevant (Edge/Opera/Samsung vor Chrome, Chrome vor Safari)
  let browser = "Sonstiges";
  if (/edg(e|a|ios)?\//i.test(ua)) browser = "Edge";
  else if (/opr\/|opera/i.test(ua)) browser = "Opera";
  else if (/samsungbrowser\//i.test(ua)) browser = "Samsung Internet";
  else if (/firefox\/|fxios\//i.test(ua)) browser = "Firefox";
  else if (/crios\/|chrome\//i.test(ua)) browser = "Chrome";
  else if (/safari\//i.test(ua) && /version\//i.test(ua)) browser = "Safari";

  return { deviceType, browser, os };
}
