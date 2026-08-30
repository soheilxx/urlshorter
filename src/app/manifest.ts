import type { MetadataRoute } from "next";

/**
 * PWA-Manifest: macht das Dashboard auf dem Smartphone installierbar
 * („Zum Startbildschirm hinzufügen“). Bewusst ohne Service Worker –
 * keine Stale-Cache-Risiken, die App lädt immer live.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TRACK.SITE",
    short_name: "TRACK.SITE",
    description: "Kurzlinks, Tracking, Analytics und Amazon-Rankings",
    start_url: "/admin",
    display: "standalone",
    background_color: "#fafafa",
    theme_color: "#1f62ff",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
