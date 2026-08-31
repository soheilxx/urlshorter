import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    // min-w-0: Als Grid-/Flex-Item darf die Karte immer auf ihre Spur
    // schrumpfen – breiter Inhalt (Charts, lange Labels) kann das Raster
    // sonst auf Mobil aufspreizen.
    <div
      className={cn("min-w-0 rounded-2xl border border-zinc-200 bg-surface shadow-sm", className)}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("border-b border-zinc-100 px-4 py-4 md:px-5", className)} {...props} />
  );
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("text-sm font-semibold text-zinc-900", className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-4 py-4 md:px-5", className)} {...props} />;
}
