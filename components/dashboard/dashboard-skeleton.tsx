import { PageHeaderSkeleton, StatCardsSkeleton, SectionSkeleton } from '@/components/loading';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <PageHeaderSkeleton />
      <StatCardsSkeleton />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <div className="lg:col-span-4">
          <Card>
            <CardContent className="p-6">
              <Skeleton className="h-[300px] w-full" />
            </CardContent>
          </Card>
        </div>
        <div className="lg:col-span-3 space-y-4">
          {[1, 2].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-[150px]" />
              </CardHeader>
              <CardContent>
                <SectionSkeleton lines={3} />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
