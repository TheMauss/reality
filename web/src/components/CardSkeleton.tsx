export default function CardSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="rounded-lg border border-border bg-surface-1 overflow-hidden">
          <div className="h-40 bg-surface-2 animate-shimmer" />
          <div className="p-4 space-y-3">
            <div className="h-4 w-3/4 bg-surface-2 rounded animate-shimmer" />
            <div className="h-3 w-1/2 bg-surface-2 rounded animate-shimmer" />
            <div className="pt-3 border-t border-border flex items-center justify-between">
              <div className="h-3 w-20 bg-surface-2 rounded animate-shimmer" />
              <div className="h-6 w-14 bg-surface-2 rounded animate-shimmer" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
