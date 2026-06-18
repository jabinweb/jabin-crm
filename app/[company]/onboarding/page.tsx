'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
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
import { Loader2, CheckCircle2, Rocket, ArrowRight, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import type { OnboardingStepId } from '@/lib/onboarding/company-onboarding';

export default function OnboardingPage() {
  const params = useParams<{ company: string }>();
  const slug = params.company;
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['onboarding', slug],
    queryFn: async () => {
      const res = await fetch('/api/onboarding', { headers: workspaceSlugHeaders(slug) });
      if (!res.ok) throw new Error('Failed to load onboarding');
      return res.json();
    },
    enabled: !!slug,
  });

  const [welcome, setWelcome] = useState({ companyName: '', businessVertical: 'general' });
  const [channels, setChannels] = useState({ email: '', phone: '', chat: true, whatsApp: false });
  const [customer, setCustomer] = useState({ organizationName: '', contactPerson: '', email: '' });

  const mutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await fetch('/api/onboarding', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...workspaceSlugHeaders(slug) },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Failed to save');
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['onboarding', slug] }),
  });

  if (isLoading || !data) {
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

  const step = (data.onboarding?.currentStep ?? 'welcome') as OnboardingStepId;
  const stepIndex = data.steps.findIndex((s: { id: string }) => s.id === step);
  const progress = Math.round(((stepIndex + 1) / data.steps.length) * 100);

  const advance = async (action: 'complete' | 'skip', payload?: Record<string, unknown>) => {
    try {
      await mutation.mutateAsync({ step, action, data: payload });
      if (step === 'complete' || (action === 'complete' && step === 'customer')) {
        await mutation.mutateAsync({ action: 'finish' });
        toast.success('Your workspace is ready!');
        router.push(`/${slug}/dashboard`);
      }
    } catch {
      toast.error('Could not save progress');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900 py-12 px-4">
      <div className="mx-auto max-w-2xl space-y-8">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 text-primary">
            <Rocket className="h-5 w-5" />
            <span className="text-sm font-semibold uppercase tracking-wider">Workspace setup</span>
          </div>
          <h1 className="text-3xl font-bold">Set up {data.company?.name ?? 'your business'}</h1>
          <p className="text-muted-foreground">
            A few steps to configure CRM, support desk, and customer portal for your team.
          </p>
        </div>

        <Progress value={progress} className="h-2" />

        <Card>
          <CardHeader>
            <CardTitle>{data.steps[stepIndex]?.title ?? 'Setup'}</CardTitle>
            <CardDescription>{data.steps[stepIndex]?.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {step === 'welcome' && (
              <>
                <div className="space-y-2">
                  <Label>Company name</Label>
                  <Input
                    value={welcome.companyName || data.company?.name || ''}
                    onChange={(e) => setWelcome((w) => ({ ...w, companyName: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Business type</Label>
                  <Select
                    value={welcome.businessVertical}
                    onValueChange={(v) => setWelcome((w) => ({ ...w, businessVertical: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BUSINESS_VERTICAL_OPTIONS.map((o) => (
                        <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>
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
                    onChange={(e) => setChannels((c) => ({ ...c, email: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Support phone</Label>
                  <Input
                    placeholder="+1 555 0100"
                    value={channels.phone}
                    onChange={(e) => setChannels((c) => ({ ...c, phone: e.target.value }))}
                  />
                </div>
                <div className="flex items-center justify-between rounded-md border p-3">
                  <Label>Enable live chat</Label>
                  <Switch checked={channels.chat} onCheckedChange={(v) => setChannels((c) => ({ ...c, chat: v }))} />
                </div>
                <div className="flex items-center justify-between rounded-md border p-3">
                  <Label>Enable WhatsApp</Label>
                  <Switch checked={channels.whatsApp} onCheckedChange={(v) => setChannels((c) => ({ ...c, whatsApp: v }))} />
                </div>
              </>
            )}

            {step === 'team' && (
              <p className="text-sm text-muted-foreground">
                Invite team members from{' '}
                <strong>Settings → Employees</strong> after setup. Support groups and agents can be
                configured under <strong>Support desk → Agent groups</strong>.
              </p>
            )}

            {step === 'customer' && (
              <>
                <p className="text-sm text-muted-foreground">Optional — add your first customer account for the portal.</p>
                <div className="space-y-2">
                  <Label>Organization</Label>
                  <Input
                    value={customer.organizationName}
                    onChange={(e) => setCustomer((c) => ({ ...c, organizationName: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Contact person</Label>
                  <Input
                    value={customer.contactPerson}
                    onChange={(e) => setCustomer((c) => ({ ...c, contactPerson: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={customer.email}
                    onChange={(e) => setCustomer((c) => ({ ...c, email: e.target.value }))}
                  />
                </div>
              </>
            )}

            {step === 'complete' && (
              <div className="text-center py-6 space-y-4">
                <CheckCircle2 className="h-12 w-12 text-emerald-600 mx-auto" />
                <p className="text-lg font-medium">You&apos;re all set!</p>
                <p className="text-sm text-muted-foreground">
                  CRM, support desk, and portal are configured. Head to your command center to start working.
                </p>
              </div>
            )}

            <div className="flex justify-between pt-4 border-t">
              <Button
                variant="ghost"
                disabled={stepIndex === 0 || mutation.isPending}
                onClick={() => router.push(`/${slug}/dashboard`)}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Skip setup
              </Button>
              <div className="flex gap-2">
                {step !== 'complete' && step !== 'welcome' && (
                  <Button variant="outline" disabled={mutation.isPending} onClick={() => advance('skip')}>
                    Skip step
                  </Button>
                )}
                <Button
                  disabled={mutation.isPending}
                  onClick={async () => {
                    if (step === 'complete') {
                      await mutation.mutateAsync({ action: 'finish' });
                      router.push(`/${slug}/dashboard`);
                      return;
                    }
                    if (step === 'welcome') {
                      await advance('complete', welcome);
                    } else if (step === 'support') {
                      await advance('complete', { channels });
                    } else if (step === 'team') {
                      await advance('skip');
                    } else if (step === 'customer') {
                      if (customer.organizationName && customer.contactPerson) {
                        await advance('complete', customer);
                      } else {
                        await advance('skip');
                      }
                      await mutation.mutateAsync({ action: 'finish' });
                      router.push(`/${slug}/dashboard`);
                    }
                  }}
                >
                  {mutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : step === 'complete' || step === 'customer' ? (
                    <>Launch workspace <Rocket className="ml-2 h-4 w-4" /></>
                  ) : (
                    <>Continue <ArrowRight className="ml-2 h-4 w-4" /></>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {data.company?.status === 'PENDING' && (
          <p className="text-center text-xs text-muted-foreground">
            Your company is pending platform approval. You can still configure your workspace.
          </p>
        )}
      </div>
    </div>
  );
}
