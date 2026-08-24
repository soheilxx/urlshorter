export default function AdminLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Wird geladen">
      <div className="h-7 w-48 animate-pulse rounded-lg bg-zinc-200" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-zinc-200/70" />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-xl bg-zinc-200/70" />
    </div>
  );
}
