'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Clock, LogIn, LogOut, Loader2 } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { cn } from '@/lib/utils';

type TodayAttendance = {
  checkIn?: string | null;
  checkOut?: string | null;
  status?: string;
};

export function PunchButton({ className }: { className?: string }) {
  const { data: session } = useSession();
  const employeeId = (session?.user as { employeeId?: string } | undefined)?.employeeId;
  const queryClient = useQueryClient();
  const { slug } = useWorkspacePaths();

  const { data: today, isLoading } = useQuery({
    queryKey: ['attendance-today-me', employeeId],
    queryFn: async () => {
      const res = await fetch('/api/employee/attendance/today');
      if (!res.ok) throw new Error('Failed to load attendance');
      return res.json() as Promise<TodayAttendance>;
    },
    enabled: !!employeeId,
    staleTime: 30_000,
  });

  const punch = useMutation({
    mutationFn: async (action: 'in' | 'out') => {
      const url =
        action === 'in'
          ? '/api/employee/attendance/check-in'
          : '/api/employee/attendance/check-out';
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action === 'in' ? { notes: 'Punched in from dashboard' } : {}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Punch failed');
      return data;
    },
    onSuccess: (_data, action) => {
      toast.success(action === 'in' ? 'Punched in' : 'Punched out');
      queryClient.invalidateQueries({ queryKey: ['attendance-today-me'] });
      queryClient.invalidateQueries({ queryKey: ['ops-today', slug] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!employeeId) return null;

  const punchedIn = !!today?.checkIn;
  const punchedOut = !!today?.checkOut;

  if (isLoading) {
    return (
      <Button variant="outline" size="sm" disabled className={cn('gap-1.5', className)}>
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span className="hidden sm:inline">Punch</span>
      </Button>
    );
  }

  if (punchedIn && punchedOut) {
    return (
      <Button variant="outline" size="sm" disabled className={cn('gap-1.5 text-muted-foreground', className)}>
        <Clock className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Done for today</span>
      </Button>
    );
  }

  if (punchedIn) {
    return (
      <Button
        variant="outline"
        size="sm"
        className={cn('gap-1.5', className)}
        disabled={punch.isPending}
        onClick={() => punch.mutate('out')}
      >
        {punch.isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <LogOut className="h-3.5 w-3.5" />
        )}
        <span className="hidden sm:inline">Punch out</span>
      </Button>
    );
  }

  return (
    <Button
      size="sm"
      className={cn('gap-1.5 bg-teal-700 hover:bg-teal-800', className)}
      disabled={punch.isPending}
      onClick={() => punch.mutate('in')}
    >
      {punch.isPending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <LogIn className="h-3.5 w-3.5" />
      )}
      <span className="hidden sm:inline">Punch in</span>
    </Button>
  );
}
