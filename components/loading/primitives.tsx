import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

type ClassNameProps = {
  className?: string;
};

export function PageHeaderSkeleton({ className }: ClassNameProps) {
  return (
    <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <Skeleton className="h-9 w-28" />
    </div>
  );
}

export function CardListSkeleton({
  rows = 5,
  className,
}: ClassNameProps & { rows?: number }) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 rounded-md border p-4">
          <Skeleton className="h-10 w-10 shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-[55%]" />
            <Skeleton className="h-3 w-[35%]" />
          </div>
          <Skeleton className="h-8 w-20 shrink-0" />
        </div>
      ))}
    </div>
  );
}

export function StatCardsSkeleton({
  count = 4,
  className,
}: ClassNameProps & { count?: number }) {
  return (
    <div className={cn('grid gap-4 sm:grid-cols-2 lg:grid-cols-4', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-md border bg-card p-4 space-y-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </div>
  );
}

export function FormSkeleton({
  fields = 4,
  className,
  /** Include a header block in the same skeleton (avoids stacking two loaders). */
  withHeader = false,
}: ClassNameProps & { fields?: number; withHeader?: boolean }) {
  return (
    <div className={cn('space-y-6', className)} aria-busy="true" aria-live="polite">
      {withHeader ? (
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
      ) : null}
      <div className="space-y-4">
        {Array.from({ length: fields }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
        <Skeleton className="h-10 w-32" />
      </div>
    </div>
  );
}

/** Settings / integrations page — one cohesive skeleton (not stacked loaders). */
export function SettingsPageSkeleton({
  cards = 6,
  className,
}: ClassNameProps & { cards?: number }) {
  return (
    <div className={cn('space-y-8', className)} aria-busy="true" aria-live="polite">
      <div className="space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: cards }).map((_, i) => (
          <div key={i} className="space-y-3 rounded-lg border bg-card p-5">
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-md" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-[66%]" />
            <Skeleton className="h-8 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function BoardSkeleton({
  columns = 4,
  cardsPerColumn = 3,
  className,
}: ClassNameProps & { columns?: number; cardsPerColumn?: number }) {
  return (
    <div className={cn('flex gap-4 overflow-x-auto pb-2', className)}>
      {Array.from({ length: columns }).map((_, col) => (
        <div key={col} className="w-72 shrink-0 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-5 w-8" />
          </div>
          <div className="min-h-[320px] space-y-2 rounded-md border bg-muted/40 p-2">
            {Array.from({ length: cardsPerColumn }).map((_, row) => (
              <div key={row} className="space-y-2 rounded-md border bg-background p-3">
                <Skeleton className="h-4 w-[80%]" />
                <Skeleton className="h-3 w-[50%]" />
                <Skeleton className="h-5 w-16" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function DetailSkeleton({ className }: ClassNameProps) {
  return (
    <div className={cn('grid gap-6 lg:grid-cols-3', className)}>
      <div className="lg:col-span-2 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-[90%]" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    </div>
  );
}

/** Matches project task detail layout to avoid layout shift on load. */
export function ProjectTaskDetailSkeleton({ className }: ClassNameProps) {
  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-72 max-w-full" />
        <Skeleton className="h-8 w-36" />
      </div>

      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6 lg:pr-8">
          <Skeleton className="h-8 w-3/4 max-w-xl" />
          <div className="space-y-3">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-40 w-full rounded-md" />
          </div>
          <div className="space-y-3">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="space-y-3 border-t pt-4">
            <Skeleton className="h-5 w-20" />
            <div className="flex gap-2">
              <Skeleton className="h-8 w-14" />
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-8 w-16" />
            </div>
            <div className="flex gap-3">
              <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
              <Skeleton className="h-10 flex-1" />
            </div>
          </div>
        </div>

        <aside className="space-y-4 border-t pt-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
          <div className="flex gap-2">
            <Skeleton className="h-9 w-36" />
            <Skeleton className="h-9 w-24" />
          </div>
          <Skeleton className="h-5 w-16" />
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="grid grid-cols-[120px_1fr] gap-3">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-28" />
            </div>
          ))}
        </aside>
      </div>
    </div>
  );
}

export function SectionSkeleton({
  className,
  lines = 4,
}: ClassNameProps & { lines?: number }) {
  return (
    <div className={cn('space-y-3', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-4 w-full"
          style={i === lines - 1 ? { width: '66%' } : undefined}
        />
      ))}
    </div>
  );
}

export function ShellSkeleton({ className }: ClassNameProps) {
  return (
    <div className={cn('fixed inset-0 flex flex-col bg-background', className)}>
      <Skeleton className="h-14 w-full rounded-none" />
      <div className="flex flex-1 min-h-0">
        <Skeleton className="hidden h-full w-64 shrink-0 rounded-none lg:block" />
        <div className="flex-1 space-y-4 p-6">
          <PageHeaderSkeleton />
          <StatCardsSkeleton />
          <SectionSkeleton lines={6} className="pt-2" />
        </div>
      </div>
    </div>
  );
}
