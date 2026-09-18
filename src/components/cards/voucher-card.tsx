import { cn } from "@/lib/utils";

/**
 * Gestaltete Wertgutschein-Karte (Cardmarket): Guthaben-Optik mit Chip,
 * holografischem Streifen und klarer Menge „10 × 100 €“. Bewusst als
 * Gestaltung erkennbar, ohne einlösbaren Code und ohne Logo-Nachbau.
 */
export function VoucherCard({
  count,
  valueLabel,
  totalLabel,
  className,
  compact = false,
}: {
  count: number;
  valueLabel: string;
  totalLabel: string;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn("cd-voucher", compact && "cd-voucher--compact", className)}
      data-testid="voucher-card"
      role="img"
      aria-label={`${count} × ${valueLabel} Cardmarket-Wertgutschein, zusammen ${totalLabel}`}
    >
      <div className="cd-voucher-holo" aria-hidden="true" />
      <div className="cd-voucher-pattern" aria-hidden="true" />
      <div className="cd-voucher-body">
        <div className="flex items-start justify-between gap-3">
          <span className="cd-voucher-chip" aria-hidden="true" />
          <span className="cd-voucher-kicker">Cardmarket-Wertgutschein</span>
        </div>
        <p className="cd-voucher-value">
          {count} × {valueLabel}
        </p>
        <p className="cd-voucher-sub">Guthaben für deine Wunschkarten</p>
        <div className="cd-voucher-foot">
          <span>
            zusammen <strong>{totalLabel}</strong>
          </span>
          <span>{count} Gewinne</span>
        </div>
      </div>
    </div>
  );
}
