export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-8 w-64 bg-surface-2 rounded animate-shimmer" />
        <div className="h-4 w-48 bg-surface-2 rounded animate-shimmer" />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="rounded-xl border border-border bg-surface-1 p-5 space-y-2">
            <div className="h-3 w-16 bg-surface-2 rounded animate-shimmer" />
            <div className="h-7 w-20 bg-surface-2 rounded animate-shimmer" />
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-surface-1 p-6 space-y-4">
        <div className="h-5 w-48 bg-surface-2 rounded animate-shimmer" />
        <div className="h-[360px] bg-surface-2 rounded animate-shimmer" />
      </div>
    </div>
  );
}
