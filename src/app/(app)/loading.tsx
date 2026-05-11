export default function Loading() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-40 animate-pulse rounded bg-muted" />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="h-28 animate-pulse rounded-lg bg-muted" />
        <div className="h-28 animate-pulse rounded-lg bg-muted" />
      </div>
      <div className="h-64 animate-pulse rounded-lg bg-muted" />
    </div>
  );
}
