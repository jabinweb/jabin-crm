'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  CheckCircle2,
  Circle,
  Users,
  Ticket,
  UserPlus,
  X,
  Package,
  FileText,
  MessageSquare,
  Wrench,
  FolderKanban,
  type LucideIcon,
} from 'lucide-react';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { useWorkspaceConfig } from '@/hooks/use-workspace-config';
import { workspaceSlugHeaders } from '@/lib/api/workspace-slug';
import { canManageCompanyOnboarding } from '@/lib/onboarding/company-onboarding';
import { cn } from '@/lib/utils';

type ChecklistItem = {
  id: string;
  label: string;
  href: string;
  done: boolean;
  icon: LucideIcon;
  optional?: boolean;
};

async function countFromList(res: Response): Promise<number> {
  if (!res.ok) return 0;
  const json = await res.json();
  if (Array.isArray(json)) return json.length;
  if (typeof json?.pagination?.total === 'number') return json.pagination.total;
  if (Array.isArray(json?.customers)) return json.customers.length;
  if (Array.isArray(json?.tickets)) return json.tickets.length;
  if (Array.isArray(json?.contracts)) return json.contracts.length;
  if (Array.isArray(json?.employees)) return json.employees.length;
  if (Array.isArray(json?.products)) return json.products.length;
  if (Array.isArray(json?.data)) return json.data.length;
  return 0;
}

export function GettingStartedChecklist() {
  const { data: session } = useSession();
  const role = session?.user?.role;
  const { slug, path, workspaceFetch } = useWorkspacePaths();
  const { data: workspaceData } = useWorkspaceConfig();
  const queryClient = useQueryClient();
  const vertical = workspaceData?.config.businessVertical;
  const isAgency = vertical === 'web_agency';

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
      return countFromList(res);
    },
    enabled: enabled && !isAgency,
  });

  const { data: employeesData } = useQuery({
    queryKey: ['getting-started-employees', slug],
    queryFn: async () => {
      const res = await workspaceFetch('/api/employees');
      return countFromList(res);
    },
    enabled,
  });

  const { data: productsData } = useQuery({
    queryKey: ['getting-started-products', slug],
    queryFn: async () => {
      const res = await workspaceFetch('/api/products');
      return countFromList(res);
    },
    enabled: enabled && !isAgency,
  });

  const { data: contractsData } = useQuery({
    queryKey: ['getting-started-contracts', slug],
    queryFn: async () => {
      const res = await workspaceFetch('/api/contracts?limit=1');
      return countFromList(res);
    },
    enabled: enabled && !isAgency,
  });

  const { data: fleetData } = useQuery({
    queryKey: ['getting-started-fleet', slug],
    queryFn: async () => {
      const res = await workspaceFetch('/api/inventory/installations');
      return countFromList(res);
    },
    enabled: enabled && !isAgency,
  });

  const { data: projectsCount } = useQuery({
    queryKey: ['getting-started-projects', slug],
    queryFn: async () => {
      const res = await workspaceFetch('/api/projects');
      return countFromList(res);
    },
    enabled: enabled && isAgency,
  });

  const { data: dealsCount } = useQuery({
    queryKey: ['getting-started-deals', slug],
    queryFn: async () => {
      const res = await workspaceFetch('/api/deals?limit=1');
      if (!res.ok) return 0;
      const json = await res.json();
      if (typeof json?.pagination?.total === 'number') return json.pagination.total;
      if (Array.isArray(json)) return json.length;
      if (Array.isArray(json?.deals)) return json.deals.length;
      return 0;
    },
    enabled: enabled && isAgency,
  });

  const { data: integrationsData } = useQuery({
    queryKey: ['getting-started-integrations', slug],
    queryFn: async () => {
      const res = await workspaceFetch('/api/dashboard/integrations');
      if (!res.ok) return null;
      return res.json() as Promise<{
        integrations?: Array<{ id: string; status: string }>;
      }>;
    },
    enabled,
    staleTime: 60_000,
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
  // Owner/admin is often already an employee — require a second teammate
  const teammateCount = employeesData ?? 0;
  const whatsappConnected =
    integrationsData?.integrations?.some(
      (i) =>
        i.id === 'whatsapp' &&
        (i.status === 'connected' || i.status === 'configured')
    ) ?? false;

  const items: ChecklistItem[] = isAgency
    ? [
        {
          id: 'client',
          label: 'Add your first client',
          href: path('/dashboard/customers/new'),
          done: customerCount > 0,
          icon: Users,
        },
        {
          id: 'project',
          label: 'Create a delivery project',
          href: path('/dashboard/projects'),
          done: (projectsCount ?? 0) > 0,
          icon: FolderKanban,
        },
        {
          id: 'deal',
          label: 'Add a deal to the pipeline',
          href: path('/dashboard/deals'),
          done: (dealsCount ?? 0) > 0,
          icon: FileText,
        },
        {
          id: 'invite',
          label: 'Invite a teammate',
          href: path('/dashboard/employees/new'),
          done: teammateCount > 1,
          icon: UserPlus,
        },
        {
          id: 'whatsapp',
          label: 'Connect WhatsApp (optional)',
          href: path('/dashboard/whatsapp'),
          done: whatsappConnected,
          icon: MessageSquare,
          optional: true,
        },
      ]
    : [
        {
          id: 'client',
          label: 'Add your first client',
          href: path('/dashboard/customers/new'),
          done: customerCount > 0,
          icon: Users,
        },
        {
          id: 'products',
          label: 'Add products to your catalogue',
          href: path('/dashboard/products'),
          done: (productsData ?? 0) > 0,
          icon: Package,
        },
        {
          id: 'fleet',
          label: 'Register an installed unit',
          href: path('/dashboard/inventory/new'),
          done: (fleetData ?? 0) > 0,
          icon: Wrench,
        },
        {
          id: 'contract',
          label: 'Create an AMC / CMC contract',
          href: path('/dashboard/contracts'),
          done: (contractsData ?? 0) > 0,
          icon: FileText,
        },
        {
          id: 'ticket',
          label: 'Create a service ticket',
          href: path('/dashboard/tickets/new'),
          done: (ticketsData ?? 0) > 0,
          icon: Ticket,
        },
        {
          id: 'whatsapp',
          label: 'Configure WhatsApp (optional)',
          href: path('/dashboard/whatsapp'),
          done: whatsappConnected,
          icon: MessageSquare,
          optional: true,
        },
        {
          id: 'invite',
          label: 'Invite a teammate',
          href: path('/dashboard/employees/new'),
          done: teammateCount > 1,
          icon: UserPlus,
        },
      ];

  const required = items.filter((i) => !i.optional);
  if (required.every((i) => i.done)) return null;

  const doneCount = required.filter((i) => i.done).length;
  const totalRequired = required.length;
  const progressPct = Math.round((doneCount / totalRequired) * 100);
  const nextItem = items.find((i) => !i.done && !i.optional) ?? items.find((i) => !i.done);

  return (
    <Card className="border-border shadow-none">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
        <div className="space-y-1">
          <CardTitle className="text-base font-semibold tracking-tight">
            Getting started
          </CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            {doneCount} of {totalRequired} complete
            {nextItem ? ` — next: ${nextItem.label.toLowerCase()}` : ''}
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
      <CardContent className="space-y-3">
        <Progress value={progressPct} className="h-1.5" />
        <ul className="divide-y divide-border rounded-lg border border-border">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-muted/50',
                    item.done && 'bg-muted/20'
                  )}
                >
                  {item.done ? (
                    <CheckCircle2
                      className="h-4 w-4 shrink-0 text-emerald-600"
                      aria-hidden
                    />
                  ) : (
                    <Circle
                      className="h-4 w-4 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                  )}
                  <Icon
                    className={cn(
                      'h-4 w-4 shrink-0',
                      item.done ? 'text-muted-foreground' : 'text-foreground/70'
                    )}
                    aria-hidden
                  />
                  <span
                    className={cn(
                      'flex-1 text-sm',
                      item.done
                        ? 'text-foreground/70'
                        : 'font-medium text-foreground'
                    )}
                  >
                    {item.label}
                    {item.done ? (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        Done
                      </span>
                    ) : null}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
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

/** True when the getting-started checklist is likely visible (for Home layout). */
export function useGettingStartedActive(): boolean {
  const { data: session } = useSession();
  const role = session?.user?.role;
  const { slug } = useWorkspacePaths();
  const enabled = !!slug && canManageCompanyOnboarding(role);

  const { data } = useQuery({
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

  if (!enabled) return false;
  if (!data?.onboarding?.completed) return false;
  if (data.onboarding?.checklistDismissedAt) return false;
  return true;
}
