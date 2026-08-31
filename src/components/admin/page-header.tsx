import { cn } from "@/lib/utils";

/**
 * Einheitlicher Seitenkopf: Titel + Beschreibung links, Aktionen rechts;
 * auf Mobil stapeln sich die Aktionen in voller Breite unter dem Titel.
 */
export function PageHeader({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-4",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="font-display text-xl font-bold tracking-tight text-zinc-900 md:text-2xl">
          {title}
        </h1>
        {description ? <p className="mt-0.5 text-sm text-zinc-500">{description}</p> : null}
      </div>
      {children ? (
        // Mobil: Aktionen gestapelt in voller Breite (einheitliche „Kästen“),
        // ab md kompakt rechtsbündig.
        <div className="flex w-full flex-col gap-2 *:w-full md:w-auto md:shrink-0 md:flex-row md:flex-wrap md:items-center md:justify-end md:*:w-auto">
          {children}
        </div>
      ) : null}
    </div>
  );
}
