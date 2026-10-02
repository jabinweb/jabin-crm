'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Users, TrendingUp, Loader2, XCircle, CreditCard } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { TableSkeleton } from '@/components/loading';
import { EmptyState } from '@/components/ui/empty-state';
import { confirmAction } from '@/lib/confirm-action';
import { formatCurrency } from '@/lib/currency';
import { humanizeEnum } from '@/lib/format/humanize';

type Plan = {
  id: string;
  name: string;
  displayName: string;
  price: number;
  currency?: string;
  interval: string;
};

const planPrice = (plan: Plan) =>
  plan.price === 0 ? 'Free' : `${formatCurrency(plan.price / 100, plan.currency || 'INR')}/${plan.interval}`;

const shortDate = (value: string) => format(new Date(value), 'MMM d, yyyy');

const STATUS_TONES: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700 hover:bg-green-100 dark:bg-green-950 dark:text-green-300',
  TRIALING: 'bg-blue-100 text-blue-700 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-300',
  CANCELED: 'bg-red-100 text-red-700 hover:bg-red-100 dark:bg-red-950 dark:text-red-300',
  PAST_DUE: 'bg-orange-100 text-orange-700 hover:bg-orange-100 dark:bg-orange-950 dark:text-orange-300',
};

type SubRow = {
  id: string;
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  createdAt: string;
  userId: string;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    role: string;
    company?: { id: string; name: string; slug: string } | null;
  };
  plan: Plan;
  workspace?: { id: string; name: string; slug: string } | null;
};

export default function SubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<SubRow[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [stats, setStats] = useState<{ status: string; _count: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [grantUserId, setGrantUserId] = useState('');
  const [grantPlanId, setGrantPlanId] = useState('');
  const [granting, setGranting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await fetch('/api/admin/subscriptions', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setSubscriptions(data.subscriptions || []);
      setPlans(data.plans || []);
      setStats(data.stats || []);
      if (data.prunedOrphanTrials > 0) {
        toast.message(`Removed ${data.prunedOrphanTrials} non-billing Free trial(s)`);
      }
    } catch (e) {
      setLoadError(true);
      toast.error(e instanceof Error ? e.message : 'Failed to load subscriptions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const activeCount = stats.find((s) => s.status === 'ACTIVE')?._count || 0;
  const trialingCount = stats.find((s) => s.status === 'TRIALING')?._count || 0;
  const canceledCount = stats.find((s) => s.status === 'CANCELED')?._count || 0;

  const getStatusColor = (status: string) =>
    STATUS_TONES[status] ?? 'bg-muted text-muted-foreground hover:bg-muted';

  const selectForUpgrade = (userId: string) => {
    setGrantUserId(userId);
    const card = document.getElementById('grant-plan');
    card?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // Move focus to the plan picker so keyboard users land where the next step is
    window.setTimeout(() => document.getElementById('grant-plan-select')?.focus(), 300);
  };

  const grantPlan = async () => {
    if (!grantUserId || !grantPlanId) {
      toast.error('Pick a billing account and a plan');
      return;
    }
    const account = subscriptions.find((s) => s.userId === grantUserId);
    const plan = plans.find((p) => p.id === grantPlanId);
    const ok = await confirmAction({
      title: `Grant ${plan?.displayName ?? 'this plan'} for 1 year?`,
      description: `${account?.workspace?.name || account?.user.name || account?.user.email || 'This account'} gets an active ${plan?.displayName ?? ''} subscription for 365 days, replacing its current plan. No payment is collected.`,
      confirmLabel: 'Grant plan',
    });
    if (!ok) return;
    setGranting(true);
    try {
      const res = await fetch('/api/admin/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: grantUserId,
          planId: grantPlanId,
          periodDays: 365,
          status: 'ACTIVE',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Grant failed');
      toast.success(`Granted ${data.planName || 'plan'} for 365 days`);
      setGrantPlanId('');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Grant failed');
    } finally {
      setGranting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Subscriptions</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Billing accounts only (one per workspace). Team users inherit the company plan.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Card>
          <CardContent className="p-3 sm:p-6">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-xs sm:text-sm font-medium text-muted-foreground">Active</p>
                <p className="mt-1 sm:mt-2 text-2xl sm:text-3xl font-semibold tabular-nums">{loading ? '—' : activeCount}</p>
              </div>
              <div className="hidden sm:block shrink-0 rounded-md bg-green-100 dark:bg-muted p-3">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-6">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-xs sm:text-sm font-medium text-muted-foreground">Trialing</p>
                <p className="mt-1 sm:mt-2 text-2xl sm:text-3xl font-semibold tabular-nums">{loading ? '—' : trialingCount}</p>
              </div>
              <div className="hidden sm:block shrink-0 rounded-md bg-blue-100 dark:bg-muted p-3">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-6">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-xs sm:text-sm font-medium text-muted-foreground">Canceled</p>
                <p className="mt-1 sm:mt-2 text-2xl sm:text-3xl font-semibold tabular-nums">{loading ? '—' : canceledCount}</p>
              </div>
              <div className="hidden sm:block shrink-0 rounded-md bg-red-100 dark:bg-muted p-3">
                <XCircle className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card id="grant-plan" className="scroll-mt-20">
        <CardHeader>
          <CardTitle className="text-base">Grant / upgrade plan</CardTitle>
          <CardDescription>
            Manually assign a bigger plan to a billing account (complimentary or sales-assisted).
            Applies to the whole company workspace.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1 space-y-1.5">
            <Label htmlFor="grant-account-select">Billing account</Label>
            <Select value={grantUserId} onValueChange={setGrantUserId}>
              <SelectTrigger id="grant-account-select">
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                {subscriptions.map((s) => (
                  <SelectItem key={s.userId} value={s.userId}>
                    {(s.workspace?.name || s.user.name || 'User') +
                      ' — ' +
                      (s.user.email || s.userId)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0 flex-1 space-y-1.5">
            <Label htmlFor="grant-plan-select">Plan</Label>
            <Select value={grantPlanId} onValueChange={setGrantPlanId}>
              <SelectTrigger id="grant-plan-select">
                <SelectValue placeholder="Select plan" />
              </SelectTrigger>
              <SelectContent>
                {plans.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.displayName} ({planPrice(p)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={grantPlan} disabled={granting || loading} className="w-full sm:w-auto">
            {granting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Grant 1 year
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Billing accounts</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <TableSkeleton columnCount={5} />
          ) : loadError ? (
            <EmptyState
              icon={CreditCard}
              title="Couldn't load subscriptions"
              description="Something went wrong while fetching billing accounts."
              actionLabel="Try again"
              onAction={() => void load()}
              className="py-10"
            />
          ) : subscriptions.length === 0 ? (
            <EmptyState
              icon={CreditCard}
              title="No billing accounts yet"
              description="Each workspace gets a billing account when it signs up or subscribes."
              className="py-10"
            />
          ) : (
            <>
            <div className="divide-y rounded-md border md:hidden">
              {subscriptions.map((subscription) => (
                  <div key={subscription.id} className="space-y-2 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {subscription.workspace?.name || subscription.user.name || 'Unnamed account'}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {subscription.user.email}
                          {subscription.workspace?.slug ? ` · /${subscription.workspace.slug}` : ''}
                        </p>
                      </div>
                      <Badge className={`shrink-0 ${getStatusColor(subscription.status)}`}>
                        {humanizeEnum(subscription.status)}
                      </Badge>
                    </div>
                    <div className="flex items-end justify-between gap-2">
                      <div className="min-w-0 text-xs text-muted-foreground">
                        <p className="truncate text-sm font-medium text-foreground">
                          {subscription.plan.displayName} · {planPrice(subscription.plan)}
                        </p>
                        <p>
                          {shortDate(subscription.currentPeriodStart)} –{' '}
                          {shortDate(subscription.currentPeriodEnd)}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-10 shrink-0"
                        onClick={() => selectForUpgrade(subscription.userId)}
                      >
                        Upgrade
                      </Button>
                    </div>
                  </div>
                ))}
            </div>
            <div className="hidden rounded-md border md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Workspace / user</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Current period</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subscriptions.map((subscription) => (
                      <TableRow key={subscription.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">
                              {subscription.workspace?.name ||
                                subscription.user.name ||
                                'Unnamed account'}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {subscription.user.email}
                              {subscription.workspace?.slug
                                ? ` · /${subscription.workspace.slug}`
                                : ''}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{subscription.plan.displayName}</p>
                            <p className="text-sm text-muted-foreground">
                              {planPrice(subscription.plan)}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(subscription.status)}>
                            {humanizeEnum(subscription.status)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <p className="whitespace-nowrap">
                              {shortDate(subscription.currentPeriodStart)} –
                            </p>
                            <p className="whitespace-nowrap">
                              {shortDate(subscription.currentPeriodEnd)}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {shortDate(subscription.createdAt)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => selectForUpgrade(subscription.userId)}
                          >
                            Upgrade
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
