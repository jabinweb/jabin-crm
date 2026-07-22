'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AttendanceTodayCard } from '@/components/dashboard/attendance-today-card';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { ArrowLeft, Clock, Users } from 'lucide-react';

export default function CompanyAttendancePage() {
  const { slug, path, workspaceFetch } = useWorkspacePaths();

  const { data: opsToday, isLoading } = useQuery({
    queryKey: ['ops-today', slug],
    queryFn: async () => {
      const res = await workspaceFetch('/api/dashboard/ops-today');
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!slug,
    refetchInterval: 60_000,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2 text-muted-foreground">
            <Link href={path('/dashboard')}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Dashboard
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">Attendance</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Today&apos;s roster status for this workspace.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={path('/dashboard/leave-requests')}>Leave requests</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={path('/dashboard/employees')}>
              <Users className="h-4 w-4 mr-1.5" />
              Employees
            </Link>
          </Button>
        </div>
      </div>

      <AttendanceTodayCard
        loading={isLoading}
        name={opsToday?.me?.name}
        attendance={opsToday?.attendance}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Late arrivals detail
            </CardTitle>
            <CardDescription>Checked in after 10:00 or marked late</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : !opsToday?.attendance?.lateList?.length ? (
              <p className="text-sm text-muted-foreground">No late arrivals today.</p>
            ) : (
              <ul className="space-y-2">
                {opsToday.attendance.lateList.map(
                  (p: { id: string; name: string; checkIn: string | null }) => (
                    <li
                      key={p.id}
                      className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                    >
                      <span className="font-medium">{p.name}</span>
                      <Badge variant="secondary">
                        {p.checkIn
                          ? new Date(p.checkIn).toLocaleTimeString(undefined, {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : 'Late'}
                      </Badge>
                    </li>
                  )
                )}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">On leave today</CardTitle>
            <CardDescription>Approved leave covering today</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : !opsToday?.attendance?.onLeaveList?.length ? (
              <p className="text-sm text-muted-foreground">Nobody on leave today.</p>
            ) : (
              <ul className="space-y-2">
                {opsToday.attendance.onLeaveList.map(
                  (p: { id: string; name: string; type: string }) => (
                    <li
                      key={p.id}
                      className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                    >
                      <span className="font-medium">{p.name}</span>
                      <Badge variant="outline">{p.type}</Badge>
                    </li>
                  )
                )}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
