export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-surface/60 ${className}`} />;
}

export function ProductCardSkeleton() {
  return (
    <div className="flex flex-col rounded-xl border border-border bg-card p-4">
      <Skeleton className="h-32 w-full rounded-lg mb-3" />
      <Skeleton className="h-3 w-16 mb-2" />
      <Skeleton className="h-4 w-full mb-2" />
      <Skeleton className="h-4 w-3/4 mb-3" />
      <div className="flex items-center justify-between pt-3">
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-9 w-9 rounded-full" />
      </div>
    </div>
  );
}

export function FeaturedCardSkeleton() {
  return (
    <div className="flex flex-col rounded-xl border border-primary/30 bg-card p-4">
      <Skeleton className="h-44 w-full rounded-lg mb-3" />
      <Skeleton className="h-4 w-full mb-2" />
      <Skeleton className="h-3 w-20 mb-2" />
      <Skeleton className="h-6 w-24" />
      <Skeleton className="h-3 w-32 mt-2" />
    </div>
  );
}
