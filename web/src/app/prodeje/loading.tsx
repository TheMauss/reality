export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-8 w-80 bg-surface-2 rounded animate-shimmer" />
        <div className="h-4 w-60 bg-surface-2 rounded animate-shimmer" />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-8">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="rounded-xl border border-border bg-surface-1 p-4 space-y-2">
            <div className="h-3 w-16 bg-surface-2 rounded animate-shimmer" />
            <div className="h-6 w-20 bg-surface-2 rounded animate-shimmer" />
            <div className="h-3 w-12 bg-surface-2 rounded animate-shimmer" />
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-surface-1 p-6 space-y-4">
        <div className="h-5 w-48 bg-surface-2 rounded animate-shimmer" />
        <div className="h-[300px] bg-surface-2 rounded animate-shimmer" />
      </div>
    </div>
  );
}
