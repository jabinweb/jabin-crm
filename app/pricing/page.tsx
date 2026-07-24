'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { PricingCountrySelector } from '@/components/pricing/pricing-country-selector';
import { startPlanCheckout } from '@/lib/payments/start-plan-checkout';
import { PageHeaderSkeleton, CardListSkeleton } from '@/components/loading';

export default function PricingPage() {
  const { data: session, status } = useSession();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [isVerifyingPayment, setIsVerifyingPayment] = useState(false);

  const { data: pricingData, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['pricing-plans'],
    queryFn: async () => {
      const response = await fetch('/api/pricing/plans');
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || body.details || 'Failed to fetch plans');
      }
      return response.json();
    },
    retry: 1,
  });

  const plans = pricingData?.plans ?? [];
  const location = pricingData?.location;
  const firstPlan = plans?.[0];
  const pppLabel = firstPlan?.pppLabel as string | undefined;
  const displayCurrency = location?.currency ?? firstPlan?.displayCurrency ?? 'INR';

  const { data: subscriptionData } = useQuery({
    queryKey: ['current-subscription'],
    enabled: status === 'authenticated',
    queryFn: async () => {
      const response = await fetch('/api/subscription/current');
      if (!response.ok) return { subscription: null };
      return response.json();
    },
  });

  const currentSubscription = subscriptionData?.subscription;

  const handleSelectPlan = async (planId: string, planName: string) => {
    setLoadingPlan(planId);
    await startPlanCheckout({
      planId,
      planName,
      session,
      onBusy: (busy) => {
        if (!busy) setLoadingPlan(null);
      },
      onVerifying: setIsVerifyingPayment,
    });
    setLoadingPlan(null);
  };

  const formatPrice = (plan: { formattedPrice?: string; displayAmount?: number; price?: number }) =>
    plan.formattedPrice ??
    (plan.displayAmount != null && plan.displayAmount > 0
      ? String(plan.displayAmount)
      : plan.price === 0
        ? 'Free'
        : '—');

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-8 px-6 py-16">
        <PageHeaderSkeleton />
        <CardListSkeleton rows={3} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-sm text-muted-foreground">
          {error instanceof Error ? error.message : 'Could not load plans'}
        </p>
        <Button variant="outline" onClick={() => refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Payment Verification Overlay */}
      {isVerifyingPayment && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-background p-8 rounded-none shadow-none text-center max-w-md mx-4">
            <div className="mb-4 flex justify-center">
              <div className="relative">
                <Loader2 className="h-16 w-16 animate-spin text-primary" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Check className="h-8 w-8 text-primary animate-pulse" />
                </div>
              </div>
            </div>
            <h2 className="text-2xl font-bold mb-2">Processing Payment</h2>
            <p className="text-muted-foreground mb-4">
              Please wait while we verify your payment and activate your subscription...
            </p>
            <div className="w-full bg-muted rounded-none h-2 overflow-hidden">
              <div className="bg-primary h-full animate-progress" style={{
                animation: 'progress 2s ease-in-out infinite'
              }}></div>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-6xl px-6 py-16 md:py-24">
        <div className="text-center mb-12 md:mb-16">
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight mb-3">
            Lowest pricing. Most features. Real support.
          </h1>
          <p className="text-base text-muted-foreground max-w-xl mx-auto mb-4 leading-relaxed">
            Competitive plans with the full service-ops pack — CRM, field tools, AMC, and HRMS —
            plus dedicated support. Team-wide seats, no per-user fee. Start free and upgrade when
            you need more.
          </p>
          {location?.countryCode && (
            <div className="flex flex-col items-center gap-3">
              <PricingCountrySelector
                countryCode={location.countryCode}
                pppLabel={pppLabel}
              />
              {displayCurrency !== 'INR' && (
                <p className="text-xs text-muted-foreground max-w-md">
                  Shown in {displayCurrency}. Checkout settles in INR via Razorpay.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 lg:gap-8 2xl:grid-cols-4 2xl:max-w-[1280px] 2xl:mx-auto">
          {plans.length === 0 ? (
            <div className="col-span-full flex flex-col items-center gap-3 py-12 text-center">
              <p className="text-sm text-muted-foreground">
                No active plans are published yet. If you expect to see Free / Starter /
                Professional, a platform admin can re-sync plans from{' '}
                <span className="font-medium text-foreground">Admin → Plans</span>.
              </p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                Refresh plans
              </Button>
            </div>
          ) : (
            plans.map((plan: any) => {
            const isCurrentPlan = currentSubscription?.planId === plan.id;
            const isFeatured = plan.name === 'professional';
            const featureList = Array.isArray(plan.features) ? plan.features : [];

            return (
              <Card
                key={plan.id}
                className={`relative flex flex-col border shadow-none ${
                  isFeatured ? 'border-foreground ring-1 ring-foreground' : 'border-border'
                }`}
              >
                {isFeatured && (
                  <div className="absolute -top-3 left-6">
                    <span className="bg-foreground text-background text-[10px] font-medium uppercase tracking-wider px-2.5 py-1">
                      Popular
                    </span>
                  </div>
                )}

                <CardHeader className="p-6 md:p-8 pb-0 space-y-0">
                  <CardTitle className="text-lg font-medium">{plan.displayName}</CardTitle>
                  <CardDescription className="text-sm leading-relaxed mt-2 min-h-[2.5rem]">
                    {plan.description}
                  </CardDescription>

                  <div className="mt-8 pt-6 border-t">
                    <p className="text-2xl md:text-3xl font-semibold tracking-tight tabular-nums break-words">
                      {plan.price === 0 ? 'Free' : formatPrice(plan)}
                    </p>
                    {plan.price > 0 && (
                      <p className="text-sm text-muted-foreground mt-1.5">per month</p>
                    )}
                    {plan.savingsPercent > 0 && (
                      <p className="text-xs text-muted-foreground mt-3">
                        {plan.savingsPercent}% regional discount
                        {plan.formattedBasePrice && (
                          <>
                            {' '}
                            ·{' '}
                            <span className="line-through">{plan.formattedBasePrice}</span> list
                          </>
                        )}
                      </p>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="flex-1 p-6 md:p-8 pt-6">
                  <ul className="space-y-3.5">
                    {featureList.map((feature: string, index: number) => (
                      <li key={index} className="flex items-start gap-3">
                        <Check className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                        <span className="text-sm text-muted-foreground leading-relaxed">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>

                <CardFooter className="p-6 md:p-8 pt-0">
                  <Button
                    className="w-full h-10"
                    variant={isFeatured ? 'default' : 'outline'}
                    disabled={isCurrentPlan || loadingPlan === plan.id}
                    onClick={() => handleSelectPlan(plan.id, plan.name)}
                  >
                    {loadingPlan === plan.id ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : isCurrentPlan ? (
                      'Current plan'
                    ) : !session ? (
                      'Sign in to continue'
                    ) : plan.price === 0 ? (
                      'Start free'
                    ) : (
                      'Upgrade'
                    )}
                  </Button>
                </CardFooter>
              </Card>
            );
          })
          )}
        </div>

        {!session && (
          <div className="mt-12 text-center">
            <p className="text-sm text-muted-foreground mb-3">Already have an account?</p>
            <Button variant="outline" asChild>
              <Link href="/auth/signin?callbackUrl=/pricing">Sign in</Link>
            </Button>
          </div>
        )}

        <div className="mt-20 pt-10 border-t text-center">
          <p className="text-sm text-muted-foreground mb-6">
            Shown in your local currency where possible. Checkout settles securely in INR via
            Razorpay. All paid plans include a 14-day money-back guarantee and dedicated support.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-10 text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <Check className="h-4 w-4" />
              No card for free plan
            </span>
            <span className="flex items-center gap-2">
              <Check className="h-4 w-4" />
              Cancel anytime
            </span>
            <span className="flex items-center gap-2">
              <Check className="h-4 w-4" />
              Secure checkout
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

