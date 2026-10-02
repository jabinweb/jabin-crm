import { StatCardsSkeleton, SectionSkeleton } from '@/components/loading';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

/** Loading state for dashboard data only — pages render their own (static) header above it. */
export function DashboardSkeleton() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <StatCardsSkeleton />
      <div className="grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-7">
        <div className="lg:col-span-4">
          <Card>
            <CardContent className="p-4 sm:p-6">
              <Skeleton className="h-[220px] w-full sm:h-[300px]" />
            </CardContent>
          </Card>
        </div>
        <div className="lg:col-span-3 space-y-4">
          {[1, 2].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-[150px] max-w-full" />
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
