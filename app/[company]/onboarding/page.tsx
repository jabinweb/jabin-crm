'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { workspaceSlugHeaders } from '@/lib/api/workspace-slug';
import { BUSINESS_VERTICAL_OPTIONS } from '@/lib/workspace-templates';
import {
  canManageCompanyOnboarding,
  normalizeOnboardingStep,
  type OnboardingStepId,
} from '@/lib/onboarding/company-onboarding';
import { Loader2, CheckCircle2, Rocket, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

export default function OnboardingPage() {
  const params = useParams<{ company: string }>();
  const slug = params.company;
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session, status: sessionStatus } = useSession();
  const role = session?.user?.role;
  const isManager = canManageCompanyOnboarding(role);

  const { data, isLoading } = useQuery({
    queryKey: ['onboarding', slug],
    queryFn: async () => {
      const res = await fetch('/api/onboarding', { headers: workspaceSlugHeaders(slug) });
      if (!res.ok) throw new Error('Failed to load onboarding');
      return res.json();
    },
    enabled: !!slug && sessionStatus === 'authenticated',
  });

  const [welcome, setWelcome] = useState({ companyName: '', businessVertical: 'general' });
  const [channels, setChannels] = useState({
    email: '',
    phone: '',
    chat: true,
    whatsApp: false,
  });
  const [prefilled, setPrefilled] = useState(false);

  useEffect(() => {
    if (!data || prefilled) return;
    setWelcome({
      companyName: data.company?.name || '',
      businessVertical: data.workspace?.businessVertical || 'general',
    });
    const ch = data.support?.channels;
    if (ch) {
      setChannels({
        email: ch.email || '',
        phone: ch.phone || '',
        chat: ch.chat !== false,
        whatsApp: !!ch.whatsApp,
      });
    }
    setPrefilled(true);
  }, [data, prefilled]);

  const mutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await fetch('/api/onboarding', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...workspaceSlugHeaders(slug) },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to save');
      }
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['onboarding', slug] }),
  });

  if (sessionStatus === 'loading' || isLoading || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (data.onboarding?.completed) {
    router.replace(`/${slug}/dashboard`);
    return null;
  }

  if (!isManager) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <Card className="max-w-md w-full shadow-none">
          <CardHeader>
            <CardTitle>Workspace setup in progress</CardTitle>
            <CardDescription>
              An admin needs to finish setting up this workspace. You can keep using your
              dashboard in the meantime.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href={`/${slug}/dashboard`}>Go to Home</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const step = normalizeOnboardingStep(data.onboarding?.currentStep) as OnboardingStepId;
  const steps = data.steps as Array<{ id: string; title: string; description: string }>;
  const stepIndex = Math.max(
    0,
    steps.findIndex((s) => s.id === step)
  );
  const progress = Math.round(((stepIndex + 1) / steps.length) * 100);

  const finishAndGo = async () => {
    await mutation.mutateAsync({ action: 'finish' });
    queryClient.invalidateQueries({ queryKey: ['onboarding-check', slug] });
    toast.success('Your workspace is ready');
    router.push(`/${slug}/dashboard`);
  };

  const saveStep = async (action: 'complete' | 'skip', payload?: Record<string, unknown>) => {
    try {
      await mutation.mutateAsync({ step, action, data: payload });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save progress');
      throw e;
    }
  };

  const verticalLabel =
    BUSINESS_VERTICAL_OPTIONS.find((o) => o.id === welcome.businessVertical)?.label ??
    welcome.businessVertical;

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-100 via-stone-50 to-white dark:from-stone-950 dark:via-stone-900 dark:to-stone-950 py-12 px-4">
      <div className="mx-auto max-w-xl space-y-8">
        <div className="text-center space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Workspace setup
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            {data.company?.name ?? 'Your business'}
          </h1>
          <p className="text-sm text-muted-foreground">
            Two quick steps — you can change everything later in Settings.
          </p>
        </div>

        <Progress value={progress} className="h-1.5" />
        <p className="text-center text-xs text-muted-foreground">
          Step {stepIndex + 1} of {steps.length}
        </p>

        <Card className="shadow-none border-foreground/10">
          <CardHeader>
            <CardTitle className="text-lg">{steps[stepIndex]?.title ?? 'Setup'}</CardTitle>
            <CardDescription>{steps[stepIndex]?.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {step === 'welcome' && (
              <>
                <div className="space-y-2">
                  <Label>Company name</Label>
                  <Input
                    value={welcome.companyName}
                    onChange={(e) =>
                      setWelcome((w) => ({ ...w, companyName: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Business type</Label>
                  <Select
                    value={welcome.businessVertical}
                    onValueChange={(v) =>
                      setWelcome((w) => ({ ...w, businessVertical: v }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BUSINESS_VERTICAL_OPTIONS.map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {step === 'support' && (
              <>
                <div className="space-y-2">
                  <Label>Support email</Label>
                  <Input
                    type="email"
                    placeholder="support@yourcompany.com"
                    value={channels.email}
                    onChange={(e) =>
                      setChannels((c) => ({ ...c, email: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Support phone</Label>
                  <Input
                    placeholder="+91 98765 43210"
                    value={channels.phone}
                    onChange={(e) =>
                      setChannels((c) => ({ ...c, phone: e.target.value }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between rounded-md border p-3">
                  <Label>Live chat</Label>
                  <Switch
                    checked={channels.chat}
                    onCheckedChange={(v) => setChannels((c) => ({ ...c, chat: v }))}
                  />
                </div>
                <div className="flex items-center justify-between rounded-md border p-3">
                  <Label>WhatsApp</Label>
                  <Switch
                    checked={channels.whatsApp}
                    onCheckedChange={(v) =>
                      setChannels((c) => ({ ...c, whatsApp: v }))
                    }
                  />
                </div>
              </>
            )}

            {step === 'complete' && (
              <div className="py-4 space-y-4">
                <div className="flex justify-center">
                  <CheckCircle2 className="h-10 w-10 text-emerald-600" />
                </div>
                <ul className="text-sm space-y-2 text-muted-foreground">
                  <li>
                    <span className="text-foreground font-medium">Company:</span>{' '}
                    {welcome.companyName || data.company?.name}
                  </li>
                  <li>
                    <span className="text-foreground font-medium">Type:</span>{' '}
                    {verticalLabel}
                  </li>
                  <li>
                    <span className="text-foreground font-medium">Channels:</span>{' '}
                    {[
                      channels.email && 'Email',
                      channels.phone && 'Phone',
                      channels.chat && 'Chat',
                      channels.whatsApp && 'WhatsApp',
                    ]
                      .filter(Boolean)
                      .join(', ') || 'None set'}
                  </li>
                </ul>
              </div>
            )}

            <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-2 pt-4 border-t">
              <Button
                variant="ghost"
                disabled={mutation.isPending}
                onClick={async () => {
                  try {
                    await finishAndGo();
                  } catch {
                    toast.error('Could not finish setup');
                  }
                }}
              >
                Skip setup
              </Button>
              <div className="flex gap-2 justify-end">
                {step === 'support' && (
                  <Button
                    variant="outline"
                    disabled={mutation.isPending}
                    onClick={async () => {
                      try {
                        await saveStep('skip');
                      } catch {
                        /* toasted */
                      }
                    }}
                  >
                    Skip step
                  </Button>
                )}
                <Button
                  disabled={mutation.isPending}
                  onClick={async () => {
                    try {
                      if (step === 'complete') {
                        await finishAndGo();
                        return;
                      }
                      if (step === 'welcome') {
                        await saveStep('complete', welcome);
                        return;
                      }
                      if (step === 'support') {
                        await saveStep('complete', { channels });
                      }
                    } catch {
                      /* toasted */
                    }
                  }}
                >
                  {mutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : step === 'complete' ? (
                    <>
                      Go to Home <Rocket className="ml-2 h-4 w-4" />
                    </>
                  ) : (
                    <>
                      Continue <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {data.company?.status === 'PENDING' && (
          <p className="text-center text-xs text-muted-foreground">
            Your company is pending platform approval. You can still configure the workspace.
          </p>
        )}
      </div>
    </div>
  );
}
