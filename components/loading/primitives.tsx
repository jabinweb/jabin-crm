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
}: ClassNameProps & { fields?: number }) {
  return (
    <div className={cn('space-y-4', className)}>
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
      <Skeleton className="h-10 w-32" />
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
