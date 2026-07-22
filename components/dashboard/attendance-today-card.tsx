'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  ClipboardList,
  Clock,
  FileBarChart2,
  Palmtree,
  PartyPopper,
  Sun,
  CloudSun,
  Moon,
} from 'lucide-react';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';

export type AttendanceSummary = {
  present: number;
  late: number;
  onLeave: number;
  notArrived: number;
  workingNow: number;
  attendancePercent: number;
  rosterSize: number;
  lateList: { id: string; name: string; checkIn: string | null }[];
  onLeaveList: { id: string; name: string; type: string }[];
};

type Props = {
  name?: string;
  attendance?: AttendanceSummary | null;
  loading?: boolean;
};

function greetingForHour(hour: number) {
  if (hour < 12) return { text: 'Good morning', Icon: Sun };
  if (hour < 17) return { text: 'Good afternoon', Icon: CloudSun };
  return { text: 'Good evening', Icon: Moon };
}

function StatCell({
  value,
  label,
  tone,
}: {
  value: number | string;
  label: string;
  tone?: 'green' | 'amber' | 'blue' | 'rose' | 'default';
}) {
  return (
    <div className="rounded-md border bg-background px-3 py-2.5 text-center min-w-0">
      <p
        className={cn(
          'text-xl font-semibold tabular-nums',
          tone === 'green' && 'text-emerald-600',
          tone === 'amber' && 'text-amber-600',
          tone === 'blue' && 'text-sky-600',
          tone === 'rose' && 'text-rose-600'
        )}
      >
        {value}
      </p>
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mt-0.5 truncate">
        {label}
      </p>
    </div>
  );
}

export function AttendanceTodayCard({ name, attendance, loading }: Props) {
  const { path } = useWorkspacePaths();
  const now = new Date();
  const { text: hello, Icon } = greetingForHour(now.getHours());
  const firstName = (name || 'there').trim().split(/\s+/)[0];

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-40 mt-2" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-md" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const a = attendance ?? {
    present: 0,
    late: 0,
    onLeave: 0,
    notArrived: 0,
    workingNow: 0,
    attendancePercent: 0,
    rosterSize: 0,
    lateList: [],
    onLeaveList: [],
  };

  const lowAttendance = a.rosterSize > 0 && a.attendancePercent < 50;

  return (
    <Card className="overflow-hidden">
      <div className="h-1 bg-teal-600" />
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-xl font-semibold flex items-center gap-2">
              {hello}, {firstName}!
              <Icon className="h-5 w-5 text-amber-500" />
            </CardTitle>
            <CardDescription className="mt-1">
              {now.toLocaleDateString(undefined, {
                weekday: 'long',
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
              {' · '}
              {now.toLocaleTimeString(undefined, {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </CardDescription>
          </div>
          <p className="text-xs text-muted-foreground">
            {a.rosterSize} active on roster
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          <StatCell value={a.present} label="Present" tone="green" />
          <StatCell value={a.late} label="Late" tone="amber" />
          <StatCell value={a.onLeave} label="On leave" tone="blue" />
          <StatCell value={a.notArrived} label="Not arrived" />
          <StatCell value={a.workingNow} label="Working now" />
          <StatCell
            value={`${a.attendancePercent}%`}
            label="Attendance"
            tone={a.attendancePercent < 50 ? 'rose' : a.attendancePercent < 80 ? 'amber' : 'green'}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-md border p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              Late arrivals
            </p>
            {a.lateList.length === 0 ? (
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                No one is late today
                <PartyPopper className="h-3.5 w-3.5 text-amber-500" />
              </p>
            ) : (
              <ul className="space-y-1.5">
                {a.lateList.map((p) => (
                  <li key={p.id} className="text-sm flex justify-between gap-2">
                    <span className="truncate font-medium">{p.name}</span>
                    {p.checkIn && (
                      <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                        {new Date(p.checkIn).toLocaleTimeString(undefined, {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
              <Palmtree className="h-3.5 w-3.5" />
              On leave today
            </p>
            {a.onLeaveList.length === 0 ? (
              <p className="text-sm text-muted-foreground">No one is on leave today</p>
            ) : (
              <ul className="space-y-1.5">
                {a.onLeaveList.map((p) => (
                  <li key={p.id} className="text-sm flex justify-between gap-2">
                    <span className="truncate font-medium">{p.name}</span>
                    <span className="text-xs text-muted-foreground shrink-0">{p.type}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {lowAttendance && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Attendance is low today ({a.attendancePercent}%). Consider sending a reminder to the team.
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          <Button asChild variant="outline" size="sm">
            <Link href={path('/dashboard/attendance')}>
              <FileBarChart2 className="h-3.5 w-3.5 mr-1.5" />
              Attendance reports
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={path('/dashboard/tasks')}>
              <ClipboardList className="h-3.5 w-3.5 mr-1.5" />
              Task assignments
            </Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href={path('/dashboard/leave-requests')}>Leave requests</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
