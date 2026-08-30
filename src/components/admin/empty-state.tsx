import type { LucideIcon } from "lucide-react";

/**
 * Freundlicher Leerzustand: Icon in weicher Primärfläche, kurzer Satz,
 * optionale Aktion (z. B. „Ersten Kurzlink anlegen“).
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <span
        aria-hidden="true"
        className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft text-primary"
      >
        <Icon className="h-6 w-6" />
      </span>
      <p className="text-sm font-semibold text-zinc-900">{title}</p>
      {description ? <p className="mt-1 max-w-sm text-sm text-zinc-500">{description}</p> : null}
      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}
