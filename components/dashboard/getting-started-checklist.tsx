'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Circle, Users, Ticket, UserPlus, X } from 'lucide-react';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { workspaceSlugHeaders } from '@/lib/api/workspace-slug';
import { canManageCompanyOnboarding } from '@/lib/onboarding/company-onboarding';
import { cn } from '@/lib/utils';

type ChecklistItem = {
  id: string;
  label: string;
  href: string;
  done: boolean;
  icon: typeof Users;
};

export function GettingStartedChecklist() {
  const { data: session } = useSession();
  const role = session?.user?.role;
  const { slug, path, workspaceFetch } = useWorkspacePaths();
  const queryClient = useQueryClient();

  const enabled = !!slug && canManageCompanyOnboarding(role);

  const { data: onboardingData } = useQuery({
    queryKey: ['onboarding', slug],
    queryFn: async () => {
      const res = await fetch('/api/onboarding', {
        headers: workspaceSlugHeaders(slug!),
      });
      if (!res.ok) return null;
      return res.json();
    },
    enabled,
    staleTime: 60_000,
  });

  const { data: customersData } = useQuery({
    queryKey: ['getting-started-customers', slug],
    queryFn: async () => {
      const res = await workspaceFetch('/api/customers?limit=1');
      if (!res.ok) return { pagination: { total: 0 } };
      return res.json();
    },
    enabled,
  });

  const { data: ticketsData } = useQuery({
    queryKey: ['getting-started-tickets', slug],
    queryFn: async () => {
      const res = await workspaceFetch('/api/tickets?limit=1');
      if (!res.ok) return [];
      const json = await res.json();
      return Array.isArray(json) ? json : json.tickets ?? [];
    },
    enabled,
  });

  const { data: employeesData } = useQuery({
    queryKey: ['getting-started-employees', slug],
    queryFn: async () => {
      const res = await workspaceFetch('/api/employees');
      if (!res.ok) return [] as unknown[];
      const json = await res.json();
      return Array.isArray(json) ? json : json.employees ?? [];
    },
    enabled,
  });

  const dismiss = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/onboarding', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...workspaceSlugHeaders(slug!),
        },
        body: JSON.stringify({ action: 'dismissChecklist' }),
      });
      if (!res.ok) throw new Error('Failed to dismiss');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding', slug] });
    },
  });

  if (!enabled) return null;
  if (!onboardingData?.onboarding?.completed) return null;
  if (onboardingData.onboarding?.checklistDismissedAt) return null;

  const customerCount =
    customersData?.pagination?.total ??
    customersData?.customers?.length ??
    0;
  const ticketCount = Array.isArray(ticketsData) ? ticketsData.length : 0;
  // /api/employees excludes the current user — any row means a teammate exists
  const teammateCount = Array.isArray(employeesData) ? employeesData.length : 0;

  const items: ChecklistItem[] = [
    {
      id: 'client',
      label: 'Add your first client',
      href: path('/dashboard/customers/new'),
      done: customerCount > 0,
      icon: Users,
    },
    {
      id: 'ticket',
      label: 'Create a service ticket',
      href: path('/dashboard/tickets/new'),
      done: ticketCount > 0,
      icon: Ticket,
    },
    {
      id: 'invite',
      label: 'Invite a teammate',
      href: path('/dashboard/employees/new'),
      done: teammateCount > 0,
      icon: UserPlus,
    },
  ];

  if (items.every((i) => i.done)) return null;

  const doneCount = items.filter((i) => i.done).length;

  return (
    <Card className="shadow-none border-foreground/10">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-base font-semibold">Getting started</CardTitle>
          <CardDescription>
            {doneCount} of {items.length} done — activate your workspace
          </CardDescription>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => dismiss.mutate()}
          disabled={dismiss.isPending}
          aria-label="Dismiss checklist"
        >
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg border p-3 transition-colors',
                item.done
                  ? 'bg-muted/30 text-muted-foreground'
                  : 'hover:bg-muted/40'
              )}
            >
              {item.done ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
              <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
              <span
                className={cn(
                  'text-sm flex-1',
                  item.done && 'line-through'
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}

/** Shown to staff when company setup is still incomplete (no hard redirect). */
export function WorkspaceSetupPendingBanner() {
  const { data: session } = useSession();
  const role = session?.user?.role;
  const { slug } = useWorkspacePaths();

  const enabled =
    !!slug &&
    !!role &&
    !canManageCompanyOnboarding(role) &&
    role !== 'CUSTOMER';

  const { data } = useQuery({
    queryKey: ['onboarding-staff-banner', slug],
    queryFn: async () => {
      const res = await fetch('/api/onboarding', {
        headers: workspaceSlugHeaders(slug!),
      });
      if (!res.ok) return { onboarding: { completed: true } };
      return res.json();
    },
    enabled,
    staleTime: 60_000,
  });

  if (!enabled || data?.onboarding?.completed !== false) return null;

  return (
    <div className="rounded-lg border border-amber-200/80 bg-amber-50/50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
      Workspace setup is still in progress. Ask a workspace admin to finish setup so
      channels and business type are configured.
    </div>
  );
}
