'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
import { CheckCircle2, Loader2, Wrench } from 'lucide-react';
import type { PortalTicketTypeDefinition } from '@/lib/support/ticket-types';

type ContextResponse = {
  organizationName: string;
  lockedEquipmentId: string | null;
  equipment: {
    id: string;
    serialNumber: string | null;
    product: { name: string; modelNumber: string | null };
  } | null;
  equipmentOptions: Array<{
    id: string;
    serialNumber: string | null;
    product: { name: string; modelNumber: string | null };
  }>;
  ticketTypes: PortalTicketTypeDefinition[];
  terminology: { ticket: string; equipment: string };
};

function equipmentLabel(item: {
  serialNumber: string | null;
  product: { name: string; modelNumber: string | null };
}) {
  const model = item.product.modelNumber ? ` (${item.product.modelNumber})` : '';
  const sn = item.serialNumber ? ` · S/N ${item.serialNumber}` : '';
  return `${item.product.name}${model}${sn}`;
}

export function ServiceRequestForm({ token }: { token: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['service-request', token],
    queryFn: async (): Promise<ContextResponse> => {
      const res = await fetch(`/api/service-request/${token}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Link not found');
      return body;
    },
  });

  const [ticketType, setTicketType] = useState('');
  const [equipmentId, setEquipmentId] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const selectedType = useMemo(
    () => data?.ticketTypes.find((t) => t.id === ticketType),
    [data?.ticketTypes, ticketType]
  );

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border bg-background p-8 text-center">
        <h1 className="text-xl font-semibold">Link not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This service request link is invalid or no longer active. Please contact your service provider.
        </p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="rounded-xl border bg-background p-8 text-center space-y-3">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-semibold">Request submitted</h1>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          Thanks — {data.organizationName} will receive this and follow up shortly. You can close this page.
        </p>
      </div>
    );
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/service-request/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketType,
          subject,
          description,
          contactName,
          contactPhone,
          equipmentId: data.lockedEquipmentId || equipmentId || undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Submission failed');
      setDone(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-xl border bg-background shadow-sm overflow-hidden">
      <div className="border-b bg-muted/30 px-6 py-5">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-lg bg-background border p-2">
            <Wrench className="h-5 w-5 text-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Raise a service request</h1>
            <p className="text-sm text-muted-foreground mt-1">
              For <span className="font-medium text-foreground">{data.organizationName}</span>
              {data.equipment ? ` · ${equipmentLabel(data.equipment)}` : ''}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={onSubmit} className="p-6 space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="contactName">Your name</Label>
            <Input
              id="contactName"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="Optional"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contactPhone">Phone</Label>
            <Input
              id="contactPhone"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              placeholder="Optional"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Issue type</Label>
          <Select value={ticketType} onValueChange={setTicketType} required>
            <SelectTrigger>
              <SelectValue placeholder="What kind of issue is this?" />
            </SelectTrigger>
            <SelectContent>
              {data.ticketTypes.map((type) => (
                <SelectItem key={type.id} value={type.id}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {!data.lockedEquipmentId && selectedType?.showEquipment !== false && data.equipmentOptions.length > 0 && (
          <div className="space-y-2">
            <Label>{data.terminology.equipment}</Label>
            <Select value={equipmentId} onValueChange={setEquipmentId}>
              <SelectTrigger>
                <SelectValue placeholder={`Select ${data.terminology.equipment.toLowerCase()} (optional)`} />
              </SelectTrigger>
              <SelectContent>
                {data.equipmentOptions.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {equipmentLabel(item)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="subject">Short summary</Label>
          <Input
            id="subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g. Ventilator alarm in OT-2"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">What happened?</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the issue, when it started, and any error messages."
            className="min-h-[120px]"
            required
          />
        </div>

        {submitError && (
          <p className="text-sm text-destructive">{submitError}</p>
        )}

        <Button type="submit" className="w-full sm:w-auto" disabled={submitting || !ticketType}>
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Submitting…
            </>
          ) : (
            'Submit request'
          )}
        </Button>
      </form>
    </div>
  );
}
