'use client';

import { useCallback, useEffect, useState } from 'react';
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
import { ArrowLeft, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useCurrency } from '@/hooks/use-currency';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { DetailSkeleton } from '@/components/loading';
import { DashboardLink } from '@/components/navigation/dashboard-link';

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
  const { formatCurrency } = useCurrency();
  const [deal, setDeal] = useState<DealDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [value, setValue] = useState('');
  const [probability, setProbability] = useState('50');
  const [stage, setStage] = useState('PROSPECTING');
  const [notes, setNotes] = useState('');

  const id = String(params.id);

  const load = useCallback(async () => {
    try {
      const res = await workspaceFetch(`/api/deals/${id}`);
      if (!res.ok) throw new Error('not found');
      const data = (await res.json()) as DealDetail;
      setDeal(data);
      setTitle(data.title);
      setValue(String(data.value));
      setProbability(String(data.probability));
      setStage(data.stage);
      setNotes(data.notes || '');
    } catch {
      setDeal(null);
      toast.error('Deal not found');
    } finally {
      setLoading(false);
    }
  }, [workspaceFetch, id]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await workspaceFetch(`/api/deals/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          value: Number(value),
          probability: Number(probability),
          stage,
          notes,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to save');
      }
      toast.success('Deal updated');
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!confirm('Delete this deal?')) return;
    const res = await workspaceFetch(`/api/deals/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      toast.error('Failed to delete deal');
      return;
    }
    toast.success('Deal deleted');
    router.push(path('/dashboard/deals'));
  };

  if (loading) return <DetailSkeleton />;

  if (!deal) {
    return (
      <div className="text-center py-16 space-y-4">
        <p className="text-muted-foreground">Deal not found</p>
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
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <DashboardLink href="/dashboard/deals">
              <ArrowLeft className="h-4 w-4" />
            </DashboardLink>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{deal.title}</h1>
            <p className="text-sm text-muted-foreground">
              {deal.lead?.companyName}
              {deal.lead?.contactName ? ` · ${deal.lead.contactName}` : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{deal.stage.replace(/_/g, ' ')}</Badge>
          <Button variant="outline" size="icon" onClick={() => void remove()}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Deal details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Value ({formatCurrency(Number(value) || 0, deal.currency as never)})</Label>
              <Input type="number" value={value} onChange={(e) => setValue(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Probability %</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={probability}
                onChange={(e) => setProbability(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Stage</Label>
            <Select value={stage} onValueChange={setStage}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STAGES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s.replace(/_/g, ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} />
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

      {deal.tasks && deal.tasks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Related tasks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {deal.tasks.map((t) => (
              <div key={t.id} className="flex justify-between text-sm">
                <span>{t.title}</span>
                <Badge variant="outline">{t.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
