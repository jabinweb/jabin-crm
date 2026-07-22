'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import { ChevronLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';

function toInputDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function NewContractPage() {
  const router = useRouter();
  const { path, workspaceFetch, slug } = useWorkspacePaths();
  const [saving, setSaving] = useState(false);

  const defaultStart = useMemo(() => toInputDate(new Date()), []);
  const defaultEnd = useMemo(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return toInputDate(d);
  }, []);

  const [form, setForm] = useState({
    customerId: '',
    type: 'AMC' as 'AMC' | 'CMC',
    title: '',
    contractNumber: '',
    startDate: defaultStart,
    endDate: defaultEnd,
    annualValue: '',
    currency: 'INR',
    includesParts: false,
    visitLimit: '',
    notes: '',
  });

  const { data: customersData, isLoading: customersLoading } = useQuery({
    queryKey: ['customers-pick', slug],
    queryFn: async () => {
      const res = await workspaceFetch('/api/customers?limit=100');
      if (!res.ok) throw new Error('Failed to load customers');
      return res.json() as Promise<{
        customers?: Array<{ id: string; organizationName: string }>;
        data?: Array<{ id: string; organizationName: string }>;
      }>;
    },
    enabled: !!slug,
  });

  const customers =
    customersData?.customers ?? customersData?.data ?? [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customerId || !form.title.trim()) {
      toast.error('Client and title are required');
      return;
    }
    setSaving(true);
    try {
      const res = await workspaceFetch('/api/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: form.customerId,
          type: form.type,
          title: form.title.trim(),
          contractNumber: form.contractNumber.trim() || null,
          startDate: form.startDate,
          endDate: form.endDate,
          annualValue: form.annualValue ? Number(form.annualValue) : null,
          currency: form.currency,
          includesParts: form.type === 'CMC' ? true : form.includesParts,
          visitLimit: form.visitLimit ? Number(form.visitLimit) : null,
          notes: form.notes.trim() || null,
          status: 'ACTIVE',
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create contract');
      }
      toast.success('Contract created');
      router.push(path('/dashboard/contracts'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create contract');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container max-w-lg py-8 space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href={path('/dashboard/contracts')}>
          <ChevronLeft className="h-4 w-4 mr-2" />
          Back to contracts
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>New AMC / CMC contract</CardTitle>
          <CardDescription>
            AMC covers labour/visits; CMC usually includes parts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Client *</Label>
              <Select
                value={form.customerId || undefined}
                onValueChange={(v) => setForm((f) => ({ ...f, customerId: v }))}
                disabled={customersLoading}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      customersLoading ? 'Loading…' : 'Select client'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.organizationName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Type *</Label>
              <Select
                value={form.type}
                onValueChange={(v: 'AMC' | 'CMC') =>
                  setForm((f) => ({
                    ...f,
                    type: v,
                    includesParts: v === 'CMC' ? true : f.includesParts,
                    title:
                      f.title ||
                      (v === 'CMC' ? 'CMC — Comprehensive' : 'AMC — Annual'),
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AMC">AMC (labour / visits)</SelectItem>
                  <SelectItem value="CMC">CMC (includes parts)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={form.title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
                placeholder="e.g. AMC — Main plant chillers"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contractNumber">Contract number</Label>
              <Input
                id="contractNumber"
                value={form.contractNumber}
                onChange={(e) =>
                  setForm((f) => ({ ...f, contractNumber: e.target.value }))
                }
                placeholder="Optional reference"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start *</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={form.startDate}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, startDate: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">End *</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={form.endDate}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, endDate: e.target.value }))
                  }
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="annualValue">Annual value</Label>
                <Input
                  id="annualValue"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.annualValue}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, annualValue: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <Input
                  id="currency"
                  value={form.currency}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, currency: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="visitLimit">Visit limit (optional)</Label>
              <Input
                id="visitLimit"
                type="number"
                min={1}
                value={form.visitLimit}
                onChange={(e) =>
                  setForm((f) => ({ ...f, visitLimit: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                rows={3}
                value={form.notes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, notes: e.target.value }))
                }
              />
            </div>

            <Button type="submit" disabled={saving} className="w-full">
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Create contract
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
