import { cn } from "@/lib/utils";

type BadgeVariant = "success" | "muted" | "warning" | "danger";

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  success: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  muted: "bg-zinc-100 text-zinc-600 ring-zinc-500/20",
  warning: "bg-amber-50 text-amber-700 ring-amber-600/20",
  danger: "bg-red-50 text-red-700 ring-red-600/20",
};

export function Badge({
  variant = "muted",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        VARIANT_CLASSES[variant],
        className,
      )}
      {...props}
    />
  );
}
