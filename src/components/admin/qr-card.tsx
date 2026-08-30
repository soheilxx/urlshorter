"use client";

import { Download } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * QR-Code zu einem Kurzlink (clientseitig generiert, kein Netzwerk-Roundtrip).
 * Ideal für Print-/Buch-Marketing; Download als PNG in Druckauflösung.
 */
export function QrCard({ url, code }: { url: string; code: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(url, {
      width: 640,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#09090b", light: "#ffffff" },
    })
      .then((result) => {
        if (!cancelled) setDataUrl(result);
      })
      .catch(() => {
        if (!cancelled) setDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <div className="flex items-center gap-4">
      {dataUrl ? (
        // dataURL statt next/image: rein clientseitig generiert
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={dataUrl}
          alt={`QR-Code für ${url}`}
          className="h-28 w-28 rounded-lg border border-zinc-200 bg-white p-1.5"
        />
      ) : (
        <div className="flex h-28 w-28 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 text-xs text-zinc-400">
          QR …
        </div>
      )}
      <div className="min-w-0 space-y-2">
        <p className="text-sm text-zinc-500">
          Scannen führt auf <span className="break-all font-mono text-zinc-700">{url}</span> – alle
          Aufrufe werden wie gewohnt getrackt.
        </p>
        {dataUrl ? (
          <a href={dataUrl} download={`qr-${code}.png`}>
            <Button variant="secondary" size="sm">
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              PNG herunterladen
            </Button>
          </a>
        ) : null}
      </div>
    </div>
  );
}
