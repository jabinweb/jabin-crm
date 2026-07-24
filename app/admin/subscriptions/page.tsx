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
import { DollarSign, Users, TrendingUp, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

type Plan = {
  id: string;
  name: string;
  displayName: string;
  price: number;
  interval: string;
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
  const [grantUserId, setGrantUserId] = useState('');
  const [grantPlanId, setGrantPlanId] = useState('');
  const [granting, setGranting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-green-100 text-green-700';
      case 'TRIALING':
        return 'bg-blue-100 text-blue-700';
      case 'CANCELED':
        return 'bg-red-100 text-red-700';
      case 'PAST_DUE':
        return 'bg-orange-100 text-orange-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const grantPlan = async () => {
    if (!grantUserId || !grantPlanId) {
      toast.error('Pick a billing account and a plan');
      return;
    }
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

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active</p>
                <p className="mt-2 text-3xl font-bold text-gray-900">{activeCount}</p>
              </div>
              <div className="rounded-none bg-green-100 p-3">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Trialing</p>
                <p className="mt-2 text-3xl font-bold text-gray-900">{trialingCount}</p>
              </div>
              <div className="rounded-none bg-blue-100 p-3">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Canceled</p>
                <p className="mt-2 text-3xl font-bold text-gray-900">{canceledCount}</p>
              </div>
              <div className="rounded-none bg-red-100 p-3">
                <DollarSign className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Grant / upgrade plan</CardTitle>
          <CardDescription>
            Manually assign a bigger plan to a billing account (complimentary or sales-assisted).
            Applies to the whole company workspace.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1 space-y-1.5">
            <Label>Billing account</Label>
            <Select value={grantUserId} onValueChange={setGrantUserId}>
              <SelectTrigger>
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
            <Label>Plan</Label>
            <Select value={grantPlanId} onValueChange={setGrantPlanId}>
              <SelectTrigger>
                <SelectValue placeholder="Select plan" />
              </SelectTrigger>
              <SelectContent>
                {plans.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.displayName} (₹{(p.price / 100).toLocaleString()}/{p.interval})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={grantPlan} disabled={granting || loading}>
            {granting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Grant 1 year
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Billing accounts</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <div className="rounded-none border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Workspace / user</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subscriptions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-muted-foreground">
                        No billing accounts yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    subscriptions.map((subscription) => (
                      <TableRow key={subscription.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">
                              {subscription.workspace?.name ||
                                subscription.user.name ||
                                'N/A'}
                            </p>
                            <p className="text-sm text-gray-600">
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
                            <p className="text-sm text-gray-600">
                              ₹{(subscription.plan.price / 100).toLocaleString()}/
                              {subscription.plan.interval}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(subscription.status)}>
                            {subscription.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <p>
                              Start:{' '}
                              {new Date(subscription.currentPeriodStart).toLocaleDateString()}
                            </p>
                            <p>
                              End:{' '}
                              {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-gray-600">
                            {new Date(subscription.createdAt).toLocaleDateString()}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setGrantUserId(subscription.userId);
                              toast.message('Selected — pick a plan above and Grant');
                            }}
                          >
                            Upgrade
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
