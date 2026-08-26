import { PageHeaderSkeleton, SectionSkeleton, StatCardsSkeleton } from '@/components/loading';

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <StatCardsSkeleton />
      <SectionSkeleton lines={8} />
    </div>
  );
}
