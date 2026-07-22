'use client';

import { useSession } from 'next-auth/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Loader2, CheckCircle2, XCircle, Calendar, CreditCard, TrendingUp, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import {
  ALL_FEATURE_MODULES,
  FEATURE_MODULE_LABELS,
  type FeatureModuleKey,
} from '@/lib/feature-module-keys';

interface Plan {
  id: string;
  name: string;
  displayName?: string;
  description: string;
  price: number;
  interval: string;
  maxLeads: number;
  maxEmails: number;
  maxCampaigns: number;
  features: string[];
  formattedPrice?: string;
  displayCurrency?: string;
}

interface Subscription {
  id: string;
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  plan: Plan;
  cancelAtPeriodEnd: boolean;
}

interface Usage {
  leadsUsed: number;
  emailsUsed: number;
  campaignsUsed: number;
  leadsLimit: number;
  emailsLimit: number;
  campaignsLimit: number;
}

interface Payment {
  id: string;
  amount: number;
  status: string;
  createdAt: string;
  razorpayPaymentId: string;
}

export default function SubscriptionSettingsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();

  // Fetch enabled modules for current user/plan
  const { data: featureAccess } = useQuery<{
    modules: Record<string, boolean>;
    planModules: Record<string, boolean>;
  }>({
    queryKey: ['feature-modules-me'],
    queryFn: async () => {
      const res = await fetch('/api/features/me');
      if (!res.ok) return { modules: {}, planModules: {} };
      return res.json();
    },
  });

  // Fetch subscription data
  const { data: subscription, isLoading: subLoading } = useQuery<Subscription | null>({
    queryKey: ['subscription'],
    queryFn: async () => {
      const res = await fetch('/api/subscription/current');
      if (!res.ok) return null;
      const data = await res.json();
      return data.subscription ?? null;
    },
  });

  // Fetch usage data
  const { data: usage, isLoading: usageLoading } = useQuery<Usage>({
    queryKey: ['usage'],
    queryFn: async () => {
      const res = await fetch('/api/subscription/usage');
      if (!res.ok) throw new Error('Failed to fetch usage');
      return res.json();
    },
  });

  // Fetch payment history
  const { data: payments, isLoading: paymentsLoading } = useQuery<Payment[]>({
    queryKey: ['payments'],
    queryFn: async () => {
      const res = await fetch('/api/payment/history');
      if (!res.ok) throw new Error('Failed to fetch payments');
      return res.json();
    },
  });

  // Fetch available plans (PPP-localized — same as /pricing checkout)
  const { data: plans } = useQuery<Plan[]>({
    queryKey: ['pricing-plans'],
    queryFn: async () => {
      const res = await fetch('/api/pricing/plans');
      if (!res.ok) throw new Error('Failed to fetch plans');
      const data = await res.json();
      return data.plans ?? [];
    },
  });

  const formatPlanPrice = (plan: { formattedPrice?: string; price: number; interval: string }) => {
    if (plan.price === 0) return 'Free';
    if (plan.formattedPrice) return plan.formattedPrice;
    return `₹${(plan.price / 100).toLocaleString('en-IN')}`;
  };

  // Cancel subscription mutation
  const cancelMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/subscription/cancel', {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to cancel subscription');
      return res.json();
    },
    onSuccess: () => {
      toast.success('Subscription cancelled. You can continue using until the end of billing period.');
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
    },
    onError: () => {
      toast.error('Failed to cancel subscription');
    },
  });

  // Reactivate subscription mutation
  const reactivateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/subscription/reactivate', {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to reactivate subscription');
      return res.json();
    },
    onSuccess: () => {
      toast.success('Subscription reactivated successfully!');
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
    },
    onError: () => {
      toast.error('Failed to reactivate subscription');
    },
  });

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      ACTIVE: { label: 'Active', variant: 'default' },
      TRIALING: { label: 'Trial', variant: 'secondary' },
      PAST_DUE: { label: 'Past Due', variant: 'destructive' },
      CANCELED: { label: 'Cancelled', variant: 'outline' },
      INCOMPLETE: { label: 'Incomplete', variant: 'outline' },
    };
    const { label, variant } = statusMap[status] || { label: status, variant: 'outline' as const };
    return <Badge variant={variant}>{label}</Badge>;
  };

  const getUsagePercentage = (used: number, limit: number) => {
    if (limit === -1) return 0; // Unlimited
    return Math.min((used / limit) * 100, 100);
  };

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 70) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  if (subLoading || usageLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!subscription || !subscription.plan) {
    return (
      <div className="space-y-6">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            No active subscription found.{' '}
            <Button variant="link" className="p-0 h-auto" onClick={() => router.push('/pricing')}>
              View pricing plans
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Subscription Settings</h1>
        <p className="text-muted-foreground mt-2">Manage your plan and billing</p>
      </div>

      {/* Current Plan */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Current Plan</CardTitle>
              <CardDescription>Your active subscription details</CardDescription>
            </div>
            {getStatusBadge(subscription.status)}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h3 className="text-2xl font-bold capitalize">
                {subscription.plan.displayName || subscription.plan.name}
              </h3>
              <p className="text-muted-foreground mt-1">{subscription.plan.description}</p>
              <div className="mt-4">
                <span className="text-3xl font-bold">
                  {subscription.plan.price === 0
                    ? 'Free'
                    : `₹${(subscription.plan.price / 100).toLocaleString('en-IN')}`}
                </span>
                <span className="text-muted-foreground">/{subscription.plan.interval}</span>
                <p className="text-xs text-muted-foreground mt-1">
                  List price · checkout may show a regional rate
                </p>
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Billing Period:</span>
                <span className="font-medium">
                  {format(new Date(subscription.currentPeriodStart), 'MMM dd, yyyy')} -{' '}
                  {format(new Date(subscription.currentPeriodEnd), 'MMM dd, yyyy')}
                </span>
              </div>
              
              {subscription.cancelAtPeriodEnd && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Your subscription will be cancelled on{' '}
                    {format(new Date(subscription.currentPeriodEnd), 'MMM dd, yyyy')}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </div>

          <Separator />

          <div>
            <h4 className="font-semibold mb-3">Plan Features</h4>
            <div className="grid gap-2 md:grid-cols-2">
              {(Array.isArray(subscription.plan.features)
                ? subscription.plan.features
                : []
              ).map((feature, index) => (
                <div key={index} className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-sm">{feature}</span>
                </div>
              ))}
            </div>
          </div>

          {featureAccess && (
            <>
              <Separator />
              <div>
                <h4 className="font-semibold mb-1">Enabled modules</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  HRMS (attendance, payroll, leave) is included for your company and is not
                  limited by plan tier.
                </p>
                <div className="grid gap-2 md:grid-cols-2">
                  {ALL_FEATURE_MODULES.filter(
                    (m) => featureAccess.modules[m as FeatureModuleKey] === true
                  ).map((module) => (
                    <div key={module} className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <span className="text-sm">
                        {FEATURE_MODULE_LABELS[module as FeatureModuleKey]}
                      </span>
                    </div>
                  ))}
                  {ALL_FEATURE_MODULES.every(
                    (m) => featureAccess.modules[m as FeatureModuleKey] !== true
                  ) && (
                    <p className="text-sm text-muted-foreground col-span-2">
                      No feature modules are enabled on your current plan.
                    </p>
                  )}
                </div>
              </div>
            </>
          )}

          <Separator />

          <div className="flex gap-3">
            <Button onClick={() => router.push('/pricing')}>
              <TrendingUp className="mr-2 h-4 w-4" />
              Upgrade Plan
            </Button>
            
            {subscription.cancelAtPeriodEnd ? (
              <Button
                variant="outline"
                onClick={() => reactivateMutation.mutate()}
                disabled={reactivateMutation.isPending}
              >
                {reactivateMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Reactivating...
                  </>
                ) : (
                  'Reactivate Subscription'
                )}
              </Button>
            ) : subscription.plan.price > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="text-destructive">
                    Cancel Subscription
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancel Subscription?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Your subscription will remain active until{' '}
                      {format(new Date(subscription.currentPeriodEnd), 'MMM dd, yyyy')}. 
                      After that, you'll be moved to the Free plan.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep Subscription</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => cancelMutation.mutate()}
                      disabled={cancelMutation.isPending}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {cancelMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Cancelling...
                        </>
                      ) : (
                        'Cancel Subscription'
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Usage Statistics */}
      {usage && (
        <Card>
          <CardHeader>
            <CardTitle>Usage This Month</CardTitle>
            <CardDescription>Track your resource consumption</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Leads Usage */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Leads</span>
                <span className="text-muted-foreground">
                  {usage.leadsUsed} / {usage.leadsLimit === -1 ? '∞' : usage.leadsLimit}
                </span>
              </div>
              <Progress 
                value={getUsagePercentage(usage.leadsUsed, usage.leadsLimit)} 
                className="h-2"
              />
            </div>

            {/* Emails Usage */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Emails Sent</span>
                <span className="text-muted-foreground">
                  {usage.emailsUsed} / {usage.emailsLimit === -1 ? '∞' : usage.emailsLimit}
                </span>
              </div>
              <Progress 
                value={getUsagePercentage(usage.emailsUsed, usage.emailsLimit)} 
                className="h-2"
              />
            </div>

            {/* Campaigns Usage */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Active Campaigns</span>
                <span className="text-muted-foreground">
                  {usage.campaignsUsed} / {usage.campaignsLimit === -1 ? '∞' : usage.campaignsLimit}
                </span>
              </div>
              <Progress 
                value={getUsagePercentage(usage.campaignsUsed, usage.campaignsLimit)} 
                className="h-2"
              />
            </div>

            {(getUsagePercentage(usage.leadsUsed, usage.leadsLimit) > 80 ||
              getUsagePercentage(usage.emailsUsed, usage.emailsLimit) > 80) && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  You're running low on resources. Consider upgrading your plan to avoid interruptions.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Available Plans */}
      {plans && plans.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Available Plans</CardTitle>
            <CardDescription>Upgrade or downgrade your subscription</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {plans.map((plan) => {
                const isCurrentPlan = plan.id === subscription.plan.id;
                return (
                  <Card key={plan.id} className={isCurrentPlan ? 'border-primary' : ''}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg capitalize">
                          {plan.displayName || plan.name}
                        </CardTitle>
                        {isCurrentPlan && <Badge>Current</Badge>}
                      </div>
                      <CardDescription className="text-2xl font-bold">
                        {formatPlanPrice(plan)}
                        {plan.price > 0 && (
                          <span className="text-sm font-normal text-muted-foreground">
                            /{plan.interval}
                          </span>
                        )}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2 text-sm">
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="h-3 w-3" />
                          {plan.maxLeads === -1 ? 'Unlimited' : plan.maxLeads} leads
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="h-3 w-3" />
                          {plan.maxEmails === -1 ? 'Unlimited' : plan.maxEmails} emails
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="h-3 w-3" />
                          {plan.maxCampaigns === -1 ? 'Unlimited' : plan.maxCampaigns} campaigns
                        </li>
                      </ul>
                      {!isCurrentPlan && (
                        <Button 
                          className="w-full mt-4" 
                          variant={plan.price > subscription.plan.price ? 'default' : 'outline'}
                          onClick={() => router.push('/pricing')}
                        >
                          {plan.price > subscription.plan.price ? 'Upgrade' : 'Downgrade'}
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment History */}
      {payments && payments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Payment History</CardTitle>
            <CardDescription>Your recent transactions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {payments.map((payment) => (
                <div key={payment.id} className="flex items-center justify-between p-4 border rounded-none">
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-none ${payment.status === 'SUCCESS' ? 'bg-green-100' : 'bg-gray-100'}`}>
                      <CreditCard className={`h-4 w-4 ${payment.status === 'SUCCESS' ? 'text-green-600' : 'text-gray-600'}`} />
                    </div>
                    <div>
                      <p className="font-medium">₹{payment.amount / 100}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(payment.createdAt), 'MMM dd, yyyy • hh:mm a')}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        ID: {payment.razorpayPaymentId}
                      </p>
                    </div>
                  </div>
                  {payment.status === 'SUCCESS' ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-gray-400" />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

