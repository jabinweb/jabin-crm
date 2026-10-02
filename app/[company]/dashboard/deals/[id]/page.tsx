'use client';

import { useCallback, useEffect, useState } from 'react';
import { useFeatureModuleMap } from '@/components/feature-module-guard';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, FolderKanban, FileText, Receipt, RefreshCw, Trash2 } from 'lucide-react';
import { humanizeEnum } from '@/lib/crm/humanize-enum';
import { toast } from 'sonner';
import { useCurrency } from '@/hooks/use-currency';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { DetailSkeleton } from '@/components/loading';
import { DashboardLink } from '@/components/navigation/dashboard-link';
import { confirmAction } from '@/lib/confirm-action';
import { DetailChrome } from '@/components/layout/detail-chrome';

type DealDetail = {
  id: string;
  title: string;
  value: number;
  currency: string;
  stage: string;
  probability: number;
  notes?: string | null;
  expectedCloseDate?: string | null;
  actualCloseDate?: string | null;
  lostReason?: string | null;
  lead?: {
    id: string;
    companyName: string;
    contactName?: string | null;
    email?: string | null;
    phone?: string | null;
  };
  user?: { id: string; name?: string | null; email?: string };
  tasks?: Array<{ id: string; title: string; status: string }>;
  projects?: Array<{ id: string; name: string; status: string; progress: number }>;
  quotations?: Array<{
    id: string;
    quotationNumber: string;
    title: string;
    status: string;
    total: number;
    currency: string;
  }>;
  invoices?: Array<{
    id: string;
    invoiceNumber: string;
    title: string;
    status: string;
    total: number;
    amountDue: number;
    currency: string;
  }>;
  createdProjectId?: string;
};

const STAGES = [
  'PROSPECTING',
  'QUALIFICATION',
  'PROPOSAL',
  'NEGOTIATION',
  'CLOSED_WON',
  'CLOSED_LOST',
] as const;

export default function DealDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { workspaceFetch, path } = useWorkspacePaths();
  // Create quote / invoice only when those modules are on the plan
  const planModules = useFeatureModuleMap();
  const { formatCurrency } = useCurrency();
  const [deal, setDeal] = useState<DealDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [title, setTitle] = useState('');
  const [value, setValue] = useState('');
  const [probability, setProbability] = useState('50');
  const [stage, setStage] = useState('PROSPECTING');
  const [notes, setNotes] = useState('');

  const id = String(params.id);

  const load = useCallback(async () => {
    setLoadError(false);
    try {
      const res = await workspaceFetch(`/api/deals/${id}`);
      if (res.status === 404 || res.status === 403) {
        setDeal(null);
        return;
      }
      if (!res.ok) throw new Error('Failed to load deal');
      const data = (await res.json()) as DealDetail;
      setDeal(data);
      setTitle(data.title);
      setValue(String(data.value));
      setProbability(String(data.probability));
      setStage(data.stage);
      setNotes(data.notes || '');
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [workspaceFetch, id]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    const numericValue = Number(value);
    const numericProbability = Number(probability);
    if (!title.trim()) {
      toast.error('Give the deal a title');
      return;
    }
    if (value.trim() === '' || !Number.isFinite(numericValue) || numericValue < 0) {
      toast.error('Enter a deal value of 0 or more');
      return;
    }
    if (!Number.isFinite(numericProbability) || numericProbability < 0 || numericProbability > 100) {
      toast.error('Probability must be between 0 and 100');
      return;
    }
    setSaving(true);
    try {
      const previousStage = deal?.stage;
      const res = await workspaceFetch(`/api/deals/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          value: numericValue,
          probability: numericProbability,
          stage,
          notes,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to save');
      }
      const updated = (await res.json()) as DealDetail;
      const projectId =
        updated.createdProjectId ||
        updated.projects?.[0]?.id ||
        null;

      if (
        stage === 'CLOSED_WON' &&
        previousStage !== 'CLOSED_WON' &&
        projectId
      ) {
        toast.success('Deal won — delivery project created', {
          action: {
            label: 'Open project',
            onClick: () => router.push(path(`/dashboard/projects/${projectId}`)),
          },
        });
      } else {
        toast.success('Deal updated');
      }
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    const ok = await confirmAction({
      title: 'Delete this deal?',
      description: 'This permanently removes the deal. This can\'t be undone.',
      confirmLabel: 'Delete',
      variant: 'destructive',
    });
    if (!ok) return;
    setDeleting(true);
    try {
      const res = await workspaceFetch(`/api/deals/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        toast.error('Failed to delete deal');
        return;
      }
      toast.success('Deal deleted');
      router.push(path('/dashboard/deals'));
    } catch {
      toast.error('Failed to delete deal');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <DetailSkeleton />;

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-6 py-16 text-center">
        <p className="text-base font-semibold">We couldn&apos;t load this deal</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Check your connection and try again.
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <Button variant="outline" asChild>
            <DashboardLink href="/dashboard/deals">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to deals
            </DashboardLink>
          </Button>
          <Button
            onClick={() => {
              setLoading(true);
              void load();
            }}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Try again
          </Button>
        </div>
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-6 py-16 text-center">
        <p className="text-base font-semibold">Deal not found</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          It may have been deleted or you may not have access to it.
        </p>
        <Button asChild>
          <DashboardLink href="/dashboard/deals">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to deals
          </DashboardLink>
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <DetailChrome
        crumbs={[
          { label: 'Deals', href: path('/dashboard/deals') },
          { label: deal.title },
        ]}
        backHref={path('/dashboard/deals')}
        backLabel="Back to deals"
      >
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{humanizeEnum(deal.stage)}</Badge>
          <Button
            variant="outline"
            size="icon"
            onClick={() => void remove()}
            disabled={deleting}
            aria-label="Delete deal"
            title="Delete deal"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </DetailChrome>

      <div>
        <h1 className="break-words text-2xl font-semibold tracking-tight">{deal.title}</h1>
        <p className="text-sm text-muted-foreground">
          {formatCurrency(deal.value || 0, deal.currency as never)}
          {deal.lead?.companyName ? ` · ${deal.lead.companyName}` : ''}
          {deal.lead?.contactName ? ` · ${deal.lead.contactName}` : ''}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Deal details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="deal-title">Title</Label>
            <Input id="deal-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="deal-value">Value ({deal.currency})</Label>
              <Input
                id="deal-value"
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="deal-probability">Probability (%)</Label>
              <Input
                id="deal-probability"
                type="number"
                inputMode="numeric"
                min={0}
                max={100}
                value={probability}
                onChange={(e) => setProbability(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="deal-stage">Stage</Label>
            <Select value={stage} onValueChange={setStage}>
              <SelectTrigger id="deal-stage">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STAGES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {humanizeEnum(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="deal-notes">Notes</Label>
            <Textarea id="deal-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} />
          </div>
          {deal.lead && (
            <p className="text-sm text-muted-foreground">
              Lead:{' '}
              <DashboardLink
                href={`/dashboard/leads/${deal.lead.id}`}
                className="underline underline-offset-2"
              >
                {deal.lead.companyName}
              </DashboardLink>
            </p>
          )}
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </CardContent>
      </Card>

      {deal.projects && deal.projects.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FolderKanban className="h-4 w-4" />
              Delivery project
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {deal.projects.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <div className="min-w-0">
                  <DashboardLink
                    href={`/dashboard/projects/${p.id}`}
                    className="font-medium underline-offset-2 hover:underline"
                  >
                    {p.name}
                  </DashboardLink>
                  <p className="text-xs text-muted-foreground">{p.progress}% complete</p>
                </div>
                <Badge variant="outline" className="shrink-0">{humanizeEnum(p.status)}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Quotations
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            className={planModules?.QUOTATIONS ? undefined : 'hidden'}
            onClick={() => {
              const q = new URLSearchParams({ dealId: deal.id });
              if (deal.lead?.email) q.set('customerEmail', deal.lead.email);
              router.push(path(`/dashboard/quotations/new?${q.toString()}`));
            }}
          >
            Create quote
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {(deal.quotations?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">No quotations linked yet.</p>
          ) : (
            deal.quotations!.map((q) => (
              <DashboardLink
                key={q.id}
                href={`/dashboard/quotations/${q.id}`}
                className="flex items-center justify-between gap-3 text-sm hover:underline"
              >
                <span className="truncate">
                  {q.quotationNumber} · {q.title}
                </span>
                <Badge variant="outline" className="shrink-0">{humanizeEnum(q.status)}</Badge>
              </DashboardLink>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
          <CardTitle className="text-base flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            Invoices
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            className={planModules?.INVOICES ? undefined : 'hidden'}
            onClick={() => {
              const q = new URLSearchParams({ dealId: deal.id });
              if (deal.lead?.email) q.set('customerEmail', deal.lead.email);
              router.push(path(`/dashboard/invoices/new?${q.toString()}`));
            }}
          >
            Create invoice
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {(deal.invoices?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">No invoices linked yet.</p>
          ) : (
            deal.invoices!.map((inv) => (
              <DashboardLink
                key={inv.id}
                href={`/dashboard/invoices/${inv.id}`}
                className="flex items-center justify-between gap-3 text-sm hover:underline"
              >
                <span className="truncate">
                  {inv.invoiceNumber} · {inv.title}
                </span>
                <Badge variant="outline" className="shrink-0">{humanizeEnum(inv.status)}</Badge>
              </DashboardLink>
            ))
          )}
        </CardContent>
      </Card>

      {deal.tasks && deal.tasks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Related follow-ups</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {deal.tasks.map((t) => (
              <DashboardLink
                key={t.id}
                href="/dashboard/tasks"
                className="flex items-center justify-between gap-3 text-sm hover:underline"
              >
                <span className="min-w-0 truncate">{t.title}</span>
                <Badge variant="outline" className="shrink-0">{humanizeEnum(t.status)}</Badge>
              </DashboardLink>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
