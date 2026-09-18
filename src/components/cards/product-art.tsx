import type { CardsWorld } from "@/lib/cards-giveaway-config";
import { cn } from "@/lib/utils";

/**
 * Illustrative Produktflächen der Cards-Gewinne (SVG, rein gestalterisch).
 *
 * Es liegen keine Originalfotos oder nutzbaren Verpackungs-/Logo-Assets der
 * verlosten Produkte im Projekt vor. Statt Verpackungen, Logos oder Karten
 * generativ nachzubauen, zeigen diese Flächen bewusst abstrahierte, klar als
 * Illustration gekennzeichnete Produktkörper mit der exakten
 * Gewinnbezeichnung. Sie sind dekorativ (aria-hidden); die Gewinnangaben
 * stehen daneben als echter Text.
 */

const WORLDS: Record<
  CardsWorld,
  {
    front: [string, string];
    top: [string, string];
    side: [string, string];
    accent: string;
    accent2: string;
    edge: string;
  }
> = {
  onepiece: {
    front: ["#123a5c", "#071a2e"],
    top: ["#2a6a8f", "#144a6a"],
    side: ["#0b2740", "#050f1c"],
    accent: "#51d9ed",
    accent2: "#e75c58",
    edge: "#ffd56a",
  },
  dragonball: {
    front: ["#4a2408", "#1a0a02"],
    top: ["#9a4a12", "#5a2a08"],
    side: ["#2a1204", "#0e0601"],
    accent: "#ff8a32",
    accent2: "#4c9dff",
    edge: "#ffb066",
  },
  yugioh: {
    front: ["#2d1858", "#120826"],
    top: ["#5a3a9a", "#3a2270"],
    side: ["#1c0e3a", "#0a0418"],
    accent: "#a88bff",
    accent2: "#ffd56a",
    edge: "#ffd56a",
  },
  cardmarket: {
    front: ["#0f2e4d", "#071a2e"],
    top: ["#1e5a8a", "#12406a"],
    side: ["#0a2038", "#04101c"],
    accent: "#65bdff",
    accent2: "#dfe7f0",
    edge: "#65bdff",
  },
};

export interface ProductBoxProps {
  world: CardsWorld;
  /** Kleine Zeile oben (Franchise) */
  kicker: string;
  /** Produktname, max. 2 Zeilen */
  title: [string, string?];
  /** Produktcode/Version (Badge), optional */
  code?: string | null;
  /** Produktform: „CASE“ / „BOOSTER BOX“ */
  form: string;
  className?: string;
  /** Größenvariante: hero (dominant) oder panel */
  size?: "hero" | "panel";
}

let gradientCounter = 0;

/** Isometrischer Produktkörper mit Front-, Deckel- und Seitenfläche. */
export function ProductBox({
  world,
  kicker,
  title,
  code,
  form,
  className,
  size = "panel",
}: ProductBoxProps) {
  const w = WORLDS[world];
  const id = `cd-${world}-${size}-${(gradientCounter += 1)}`;
  return (
    <svg
      viewBox="0 0 320 340"
      role="img"
      aria-hidden="true"
      focusable="false"
      className={cn("h-auto w-full", className)}
    >
      <defs>
        <linearGradient id={`${id}-front`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={w.front[0]} />
          <stop offset="1" stopColor={w.front[1]} />
        </linearGradient>
        <linearGradient id={`${id}-top`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={w.top[0]} />
          <stop offset="1" stopColor={w.top[1]} />
        </linearGradient>
        <linearGradient id={`${id}-side`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={w.side[0]} />
          <stop offset="1" stopColor={w.side[1]} />
        </linearGradient>
        <linearGradient id={`${id}-gloss`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.16" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.02" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0.1" />
        </linearGradient>
      </defs>

      {/* Schatten */}
      <ellipse cx="170" cy="326" rx="140" ry="12" fill="#000" opacity="0.45" />

      {/* Seitenfläche */}
      <polygon points="230,120 290,84 290,284 230,320" fill={`url(#${id}-side)`} />
      <polygon
        points="230,120 290,84 290,284 230,320"
        fill="none"
        stroke={w.edge}
        strokeOpacity="0.35"
      />

      {/* Deckel */}
      <polygon points="40,120 230,120 290,84 100,84" fill={`url(#${id}-top)`} />
      <polygon
        points="40,120 230,120 290,84 100,84"
        fill="none"
        stroke={w.edge}
        strokeOpacity="0.5"
      />
      <line
        x1="72"
        y1="102"
        x2="258"
        y2="102"
        stroke="#000"
        strokeOpacity="0.25"
        strokeDasharray="6 4"
      />

      {/* Front */}
      <rect x="40" y="120" width="190" height="200" fill={`url(#${id}-front)`} />
      <rect x="40" y="120" width="190" height="200" fill={`url(#${id}-gloss)`} />
      <rect
        x="40.5"
        y="120.5"
        width="189"
        height="199"
        fill="none"
        stroke={w.edge}
        strokeOpacity="0.6"
      />

      {/* Kartenrahmen als Motiv-Andeutung */}
      <rect
        x="62"
        y="150"
        width="146"
        height="112"
        rx="6"
        fill="none"
        stroke={w.accent}
        strokeOpacity="0.7"
        strokeWidth="1.5"
      />
      <rect x="70" y="158" width="130" height="96" rx="4" fill={w.accent} fillOpacity="0.08" />
      <path d="M78 246 L120 198 L146 226 L168 204 L192 246 Z" fill={w.accent} fillOpacity="0.28" />
      <circle cx="176" cy="178" r="9" fill={w.accent2} fillOpacity="0.85" />
      <path
        d="M62 150 l14 -10 M208 150 l-14 -10"
        stroke={w.accent2}
        strokeOpacity="0.8"
        strokeWidth="2"
      />

      {/* Texte (exakte Gewinnbezeichnung, kein Logo-Nachbau) */}
      <text
        x="62"
        y="140"
        fill={w.accent}
        fontSize="9.5"
        fontWeight="700"
        letterSpacing="2"
        fontFamily="var(--font-sans)"
      >
        {kicker.toUpperCase()}
      </text>
      <text
        x="62"
        y="284"
        fill="#f5f2e9"
        fontSize={title[1] ? "15" : "17"}
        fontWeight="700"
        fontFamily="var(--font-display)"
      >
        {title[0]}
      </text>
      {title[1] ? (
        <text
          x="62"
          y="302"
          fill="#f5f2e9"
          fontSize="13"
          fontWeight="600"
          fontFamily="var(--font-display)"
        >
          {title[1]}
        </text>
      ) : null}
      {code ? (
        <g>
          <rect x="62" y="306" width={code.length * 8 + 14} height="14" rx="2" fill={w.edge} />
          <text
            x="69"
            y="316.5"
            fill="#17120a"
            fontSize="9"
            fontWeight="800"
            letterSpacing="1"
            fontFamily="var(--font-sans)"
          >
            {code}
          </text>
        </g>
      ) : null}
      <g>
        <rect
          x={code ? code.length * 8 + 84 : 62}
          y="306"
          width={form.length * 7.2 + 14}
          height="14"
          rx="2"
          fill="none"
          stroke={w.accent}
          strokeOpacity="0.9"
        />
        <text
          x={code ? code.length * 8 + 91 : 69}
          y="316.5"
          fill={w.accent}
          fontSize="9"
          fontWeight="800"
          letterSpacing="1.5"
          fontFamily="var(--font-sans)"
        >
          {form}
        </text>
      </g>
    </svg>
  );
}

/** Wertgutschein-Illustration (Cardmarket): kein einlösbarer Code, klar als Illustration. */
export function VoucherArt({
  className,
  count,
  value,
}: {
  className?: string;
  count: number;
  value: string;
}) {
  const w = WORLDS.cardmarket;
  return (
    <svg
      viewBox="0 0 360 220"
      role="img"
      aria-hidden="true"
      focusable="false"
      className={cn("h-auto w-full", className)}
    >
      <defs>
        <linearGradient id="cd-voucher-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={w.top[0]} />
          <stop offset="1" stopColor={w.front[1]} />
        </linearGradient>
        <linearGradient id="cd-voucher-silver" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#dfe7f0" stopOpacity="0.9" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.5" />
          <stop offset="1" stopColor="#b7c2d8" stopOpacity="0.9" />
        </linearGradient>
      </defs>
      <rect x="10" y="20" width="340" height="180" rx="14" fill="url(#cd-voucher-bg)" />
      <rect
        x="10.5"
        y="20.5"
        width="339"
        height="179"
        rx="14"
        fill="none"
        stroke={w.accent}
        strokeOpacity="0.8"
      />
      <rect
        x="22"
        y="32"
        width="316"
        height="156"
        rx="10"
        fill="none"
        stroke="url(#cd-voucher-silver)"
        strokeOpacity="0.5"
        strokeDasharray="4 6"
      />
      <circle cx="10" cy="110" r="12" fill="#080c18" />
      <circle cx="350" cy="110" r="12" fill="#080c18" />
      <text
        x="34"
        y="62"
        fill={w.accent}
        fontSize="11"
        fontWeight="700"
        letterSpacing="2.5"
        fontFamily="var(--font-sans)"
      >
        WERTGUTSCHEIN · ILLUSTRATION
      </text>
      <text
        x="34"
        y="118"
        fill="#f5f2e9"
        fontSize="46"
        fontWeight="700"
        fontFamily="var(--font-display)"
      >
        {count} × {value}
      </text>
      <text
        x="34"
        y="150"
        fill="#dfe7f0"
        fontSize="15"
        fontWeight="600"
        fontFamily="var(--font-display)"
      >
        Cardmarket-Wertgutschein
      </text>
      <text
        x="34"
        y="172"
        fill={w.accent2}
        fillOpacity="0.8"
        fontSize="10.5"
        letterSpacing="1"
        fontFamily="var(--font-sans)"
      >
        DEINE WUNSCHKARTEN · DEINE ENTSCHEIDUNG
      </text>
      <g opacity="0.55">
        <rect x="262" y="128" width="58" height="40" rx="4" fill="none" stroke="#dfe7f0" />
        <rect x="270" y="136" width="42" height="6" rx="1" fill="#dfe7f0" opacity="0.5" />
        <rect x="270" y="148" width="26" height="6" rx="1" fill="#dfe7f0" opacity="0.5" />
      </g>
    </svg>
  );
}
