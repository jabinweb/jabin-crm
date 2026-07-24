import { CardListSkeleton, PageHeaderSkeleton } from '@/components/loading';

export function LeadsLoading() {
  return (
    <div className="space-y-4 animate-in fade-in-0">
      <PageHeaderSkeleton />
      <CardListSkeleton rows={5} />
    </div>
  );
}
