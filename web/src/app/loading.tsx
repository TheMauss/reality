import CardSkeleton from "@/components/CardSkeleton";

export default function Loading() {
  return (
    <div className="space-y-10">
      {/* Hero skeleton */}
      <div className="rounded-lg border border-border bg-surface-1 overflow-hidden">
        <div className="px-8 py-12 md:px-14 md:py-16 max-w-2xl space-y-4">
          <div className="h-6 w-40 bg-surface-2 rounded-full animate-shimmer" />
          <div className="h-10 w-96 max-w-full bg-surface-2 rounded animate-shimmer" />
          <div className="h-4 w-72 max-w-full bg-surface-2 rounded animate-shimmer" />
        </div>
      </div>

      {/* Stats skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-border rounded-lg overflow-hidden border border-border">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="bg-surface-1 px-5 py-4 space-y-2">
            <div className="h-7 w-16 bg-surface-2 rounded animate-shimmer" />
            <div className="h-3 w-24 bg-surface-2 rounded animate-shimmer" />
          </div>
        ))}
      </div>

      {/* Cards skeleton */}
      <div className="space-y-4">
        <div className="h-5 w-40 bg-surface-2 rounded animate-shimmer" />
        <CardSkeleton count={6} />
      </div>
    </div>
  );
}
