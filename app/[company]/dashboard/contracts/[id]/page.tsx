'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ChevronLeft, Loader2, Download } from 'lucide-react';
import { toast } from 'sonner';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { DetailSkeleton } from '@/components/loading';

function toInputDate(iso: string) {
  return new Date(iso).toISOString().slice(0, 10);
}

export default function ContractDetailPage() {
  const params = useParams<{ company: string; id: string }>();
  const router = useRouter();
  const { path, workspaceFetch, slug } = useWorkspacePaths();
  const queryClient = useQueryClient();
  const id = params.id;
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['contract', slug, id],
    queryFn: async () => {
      const res = await workspaceFetch(`/api/contracts/${id}`);
      if (!res.ok) throw new Error('Contract not found');
      const json = await res.json();
      return (json.data ?? json) as {
        id: string;
        title: string;
        type: 'AMC' | 'CMC';
        status: string;
        contractNumber: string | null;
        startDate: string;
        endDate: string;
        annualValue: number | null;
        currency: string;
        includesParts: boolean;
        visitLimit: number | null;
        visitsUsed: number;
        remaining: number | null;
        overLimit: boolean;
        notes: string | null;
        reminderDays: number;
        customer: { id: string; organizationName: string; city: string | null };
        equipment: {
          id: string;
          serialNumber: string | null;
          product: { name: string; modelNumber: string | null } | null;
        } | null;
      };
    },
    enabled: !!slug && !!id,
  });

  const [form, setForm] = useState({
    title: '',
    status: 'ACTIVE',
    startDate: '',
    endDate: '',
    annualValue: '',
    visitLimit: '',
    notes: '',
    reminderDays: '45',
  });

  useEffect(() => {
    if (!data) return;
    setForm({
      title: data.title,
      status: data.status,
      startDate: toInputDate(data.startDate),
      endDate: toInputDate(data.endDate),
      annualValue: data.annualValue != null ? String(data.annualValue) : '',
      visitLimit: data.visitLimit != null ? String(data.visitLimit) : '',
      notes: data.notes || '',
      reminderDays: String(data.reminderDays ?? 45),
    });
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await workspaceFetch(`/api/contracts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          status: form.status,
          startDate: form.startDate,
          endDate: form.endDate,
          annualValue: form.annualValue ? Number(form.annualValue) : null,
          visitLimit: form.visitLimit ? Number(form.visitLimit) : null,
          notes: form.notes || null,
          reminderDays: Number(form.reminderDays) || 45,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to save');
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success('Contract updated');
      queryClient.invalidateQueries({ queryKey: ['contract', slug, id] });
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const downloadPdf = async () => {
    setDownloadingPdf(true);
    try {
      const response = await workspaceFetch(`/api/contracts/${id}/pdf`);
      if (!response.ok) throw new Error('Failed to download PDF');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `contract-${data?.contractNumber || id.slice(0, 8)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'PDF download failed');
    } finally {
      setDownloadingPdf(false);
    }
  };

  if (isLoading) {
    return <DetailSkeleton />;
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Contract not found.</p>
        <Button variant="outline" onClick={() => router.push(path('/dashboard/contracts'))}>
          Back to contracts
        </Button>
      </div>
    );
  }

  const visitPct =
    data.visitLimit != null && data.visitLimit > 0
      ? Math.min(100, Math.round((data.visitsUsed / data.visitLimit) * 100))
      : null;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href={path('/dashboard/contracts')}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Contracts
          </Link>
        </Button>
        <Badge variant="outline">{data.type}</Badge>
        <Badge>{data.status}</Badge>
        <Button
          variant="outline"
          size="sm"
          className="ml-auto"
          disabled={downloadingPdf}
          onClick={downloadPdf}
        >
          {downloadingPdf ? (
            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-1.5" />
          )}
          Download PDF
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{data.title}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {data.customer.organizationName}
          {data.contractNumber ? ` · #${data.contractNumber}` : ''}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Visit utilisation</CardTitle>
          <CardDescription>
            Resolved/closed tickets linked to this contract count as visits.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.visitLimit != null ? (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>
                  {data.visitsUsed} used · {data.remaining ?? 0} remaining
                </span>
                <span className={data.overLimit ? 'text-destructive' : 'text-muted-foreground'}>
                  Limit {data.visitLimit}
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={
                    data.overLimit
                      ? 'h-full bg-destructive'
                      : visitPct != null && visitPct >= 80
                        ? 'h-full bg-amber-500'
                        : 'h-full bg-primary'
                  }
                  style={{ width: `${visitPct ?? 0}%` }}
                />
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No visit limit · {data.visitsUsed} visit{data.visitsUsed === 1 ? '' : 's'} logged
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
          <CardDescription>
            {data.equipment
              ? `Equipment: ${data.equipment.product?.name || 'Unit'}${
                  data.equipment.serialNumber ? ` (${data.equipment.serialNumber})` : ''
                }`
              : 'No equipment linked'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="EXPIRED">Expired</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Reminder (days before end)</Label>
              <Input
                type="number"
                value={form.reminderDays}
                onChange={(e) => setForm((f) => ({ ...f, reminderDays: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Start</Label>
              <Input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>End</Label>
              <Input
                type="date"
                value={form.endDate}
                onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Annual value ({data.currency})</Label>
              <Input
                type="number"
                value={form.annualValue}
                onChange={(e) => setForm((f) => ({ ...f, annualValue: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Visit limit</Label>
              <Input
                type="number"
                min={1}
                placeholder="Unlimited"
                value={form.visitLimit}
                onChange={(e) => setForm((f) => ({ ...f, visitLimit: e.target.value }))}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              rows={4}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>
          <Button disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
            {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save changes
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
