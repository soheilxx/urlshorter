import { cn } from "@/lib/utils";

/**
 * Tabellen-Bausteine. TableWrapper scrollt horizontal mit Scroll-Fade-Kanten
 * (CSS-Utility .scroll-x-fade in globals.css); stickyFirstColumn fixiert die
 * erste Spalte für breite Tabellen (Klicks, Kurzlinks, Amazon-KPIs).
 */

export function TableWrapper({
  className,
  stickyFirstColumn = false,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { stickyFirstColumn?: boolean }) {
  return (
    <div
      className={cn(
        "scroll-x-fade overflow-x-auto",
        stickyFirstColumn && "table-sticky-first",
        className,
      )}
      {...props}
    />
  );
}

export function Table({
  className,
  minWidth,
  style,
  ...props
}: React.TableHTMLAttributes<HTMLTableElement> & { minWidth?: number }) {
  return (
    <table
      className={cn("w-full border-collapse text-sm", className)}
      style={minWidth ? { minWidth, ...style } : style}
      {...props}
    />
  );
}

export function Thead({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("border-b border-zinc-200", className)} {...props} />;
}

export function Th({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-zinc-500 uppercase",
        className,
      )}
      {...props}
    />
  );
}

export function Td({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn("border-b border-zinc-100 px-3 py-2.5 align-middle", className)} {...props} />
  );
}
