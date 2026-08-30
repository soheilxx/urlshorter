import { cn } from "@/lib/utils";

/*
 * Formular-Controls: mobil 16-px-Schrift (verhindert iOS-Auto-Zoom) und
 * 44-px-Höhe, ab md kompakter. Fokusring in Primärfarbe.
 */

const CONTROL_BASE = cn(
  "w-full rounded-xl border border-zinc-300 bg-surface text-zinc-900",
  "placeholder:text-zinc-400",
  "focus:border-primary focus:outline-2 focus:outline-offset-0 focus:outline-primary/20",
  "disabled:cursor-not-allowed disabled:bg-zinc-100",
);

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(CONTROL_BASE, "h-11 px-3 text-base md:h-10 md:text-sm", className)}
      {...props}
    />
  );
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(CONTROL_BASE, "px-3 py-2 text-base md:text-sm", className)}
      {...props}
    />
  );
}

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(CONTROL_BASE, "h-11 px-3 text-base md:h-10 md:text-sm", className)}
      {...props}
    />
  );
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={cn("mb-1.5 block text-xs font-medium text-zinc-700", className)} {...props} />
  );
}
