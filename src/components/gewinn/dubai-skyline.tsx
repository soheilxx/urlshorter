/**
 * Dekorative Dubai-Skyline als eigene SVG-Zeichnung (lizenzfrei):
 * Burj Al Arab (Segel), Emirates Towers, Burj Khalifa (Mitte),
 * Cayan Tower (Drehung angedeutet) und Dubai Frame – als goldene
 * Silhouette mit Verlauf, rein dekorativ (aria-hidden).
 */
export function DubaiSkyline({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1200 200"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
      className={className}
    >
      <defs>
        <linearGradient id="gw-sky-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e2c184" stopOpacity="0.55" />
          <stop offset="0.65" stopColor="#d6b26f" stopOpacity="0.18" />
          <stop offset="1" stopColor="#d6b26f" stopOpacity="0.05" />
        </linearGradient>
      </defs>

      {/* Hintere Ebene: entfernte Gebäude */}
      <g fill="url(#gw-sky-gold)" opacity="0.4">
        <path d="M20 200 V158 H52 V200 Z M120 200 V166 H160 V200 Z M270 200 V172 H310 V200 Z M350 200 V150 H375 V200 Z M480 200 V140 H505 V200 Z M525 200 V158 H548 V200 Z M660 200 V148 H685 V200 Z M735 200 V168 H770 V200 Z M905 200 V152 H932 V200 Z M1070 200 V160 H1096 V200 Z M1150 200 V146 H1178 V200 Z" />
      </g>

      {/* Vordere Ebene: markante Silhouetten */}
      <g fill="url(#gw-sky-gold)">
        {/* Burj Al Arab */}
        <path d="M64 200 L64 100 Q66 44 118 30 L126 200 Z" />
        <path d="M114 36 L118 10 L121 10 L120 34 Z" />
        {/* Türme */}
        <path d="M160 200 V130 H185 V200 Z M196 200 V150 H214 V200 Z M224 200 V118 H252 V200 Z" />
        {/* Emirates Towers */}
        <path d="M380 200 V96 L404 78 V200 Z" />
        <path d="M420 200 V110 L442 92 V200 Z" />
        {/* Burj Khalifa */}
        <path d="M582 200 V160 H590 V110 H597 V70 H603 V40 H609 V4 H612 V40 H617 V70 H623 V110 H630 V160 H638 V200 Z" />
        {/* Cayan Tower (Drehung angedeutet) */}
        <path d="M700 200 V120 Q716 112 714 84 Q712 64 726 58 L734 200 Z" />
        {/* Türme */}
        <path d="M760 200 V105 H786 V200 Z M800 200 V135 H824 V200 Z M840 200 V88 H862 V200 Z" />
        {/* Dubai Frame */}
        <path d="M960 200 V70 H1060 V200 H1044 V86 H976 V200 Z" />
      </g>
    </svg>
  );
}
