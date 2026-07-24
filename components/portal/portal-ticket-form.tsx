'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ChevronLeft, Loader2, Send, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { KbDeflection } from '@/components/portal/kb-deflection';
import { FormSkeleton } from '@/components/loading';
import type {
  PortalTicketField,
  PortalTicketTypeDefinition,
} from '@/lib/support/ticket-types';

type TicketTypesResponse = {
  ticketTypes: PortalTicketTypeDefinition[];
  terminology: {
    ticket: string;
    newRequest: string;
    equipment: string;
  };
  features: {
    equipment: boolean;
    products: boolean;
  };
  channels?: {
    email?: string;
    phone?: string;
    chat?: boolean;
    whatsApp?: boolean;
  };
};

function DynamicField({
  field,
  value,
  onChange,
}: {
  field: PortalTicketField;
  value: string;
  onChange: (value: string) => void;
}) {
  if (field.type === 'textarea') {
    return (
      <Textarea
        id={field.id}
        placeholder={field.placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={field.required}
        className="min-h-[100px] border-slate-100 bg-slate-50/50"
      />
    );
  }

  if (field.type === 'select' && field.options?.length) {
    return (
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-11 border-slate-100 bg-slate-50/50">
          <SelectValue placeholder={field.placeholder ?? 'Select…'} />
        </SelectTrigger>
        <SelectContent>
          {field.options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <Input
      id={field.id}
      type={
        field.type === 'number'
          ? 'number'
          : field.type === 'email'
            ? 'email'
            : field.type === 'phone'
              ? 'tel'
              : 'text'
      }
      placeholder={field.placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={field.required}
      className="h-11 border-slate-100 bg-slate-50/50"
    />
  );
}

export function PortalTicketForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const equipmentIdParam = searchParams.get('equipmentId');

  const { data, isLoading } = useQuery<TicketTypesResponse>({
    queryKey: ['portal-ticket-types'],
    queryFn: async () => {
      const res = await fetch('/api/portal/ticket-types');
      if (!res.ok) throw new Error('Failed to load ticket types');
      return res.json();
    },
  });

  const ticketTypes = data?.ticketTypes ?? [];
  const terminology = data?.terminology;

  const [ticketTypeId, setTicketTypeId] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('');
  const [equipmentId, setEquipmentId] = useState(equipmentIdParam || '');
  const [customFields, setCustomFields] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [issueResolved, setIssueResolved] = useState(false);

  const selectedType = useMemo(
    () => ticketTypes.find((t) => t.id === ticketTypeId),
    [ticketTypes, ticketTypeId]
  );

  useEffect(() => {
    if (ticketTypes.length && !ticketTypeId) {
      setTicketTypeId(ticketTypes[0].id);
    }
  }, [ticketTypes, ticketTypeId]);

  useEffect(() => {
    if (selectedType) {
      setPriority(selectedType.defaultPriority);
      setCustomFields({});
    }
  }, [selectedType?.id]);

  useEffect(() => {
    if (equipmentIdParam) {
      setEquipmentId(equipmentIdParam);
    }
  }, [equipmentIdParam]);

  const { data: equipmentOptions } = useQuery({
    queryKey: ['portal-equipment-options'],
    enabled: selectedType?.showEquipment === true,
    queryFn: async () => {
      const res = await fetch('/api/portal/equipment/options');
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: productOptions } = useQuery({
    queryKey: ['portal-product-options'],
    enabled: selectedType?.showProduct === true,
    queryFn: async () => {
      const res = await fetch('/api/products?limit=100');
      if (!res.ok) return { products: [] };
      const body = await res.json();
      return body.products ?? body ?? [];
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedType || !subject.trim() || !description.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketType: selectedType.id,
          subject: subject.trim(),
          description: description.trim(),
          priority: priority || selectedType.defaultPriority,
          equipmentId: selectedType.showEquipment ? equipmentId : undefined,
          customFields,
        }),
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof body.error === 'string' ? body.error : 'Failed to create ticket');
      }

      toast.success(`${terminology?.ticket ?? 'Ticket'} submitted successfully`);
      router.push('/portal/tickets');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to submit request');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <FormSkeleton fields={5} className="py-8" />;
  }

  if (issueResolved) {
    return (
      <div className="mx-auto max-w-lg space-y-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Glad we could help!</h1>
        <p className="text-muted-foreground">No ticket was created. You can return to your dashboard anytime.</p>
        <Button onClick={() => router.push('/portal')}>Back to dashboard</Button>
      </div>
    );
  }

  const ticketLabel = terminology?.ticket ?? 'Ticket';
  const kbSearch = [subject, description].filter(Boolean).join(' ').trim();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center space-x-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push('/portal/tickets')}
          className="rounded-none"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">
            {terminology?.newRequest ?? `New ${ticketLabel}`}
          </h1>
          <p className="text-sm text-slate-500">
            Choose a category and tell us how we can help.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card className="border-none border-t-4 border-t-blue-600 bg-white shadow-none dark:bg-slate-900">
            <CardHeader>
              <CardTitle className="text-lg">Request details</CardTitle>
              <CardDescription>
                {selectedType?.description ?? 'Select a request type to get started.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <KbDeflection
                  ticketTypeId={selectedType?.id}
                  searchQuery={kbSearch.length >= 8 ? kbSearch : undefined}
                  onResolved={() => setIssueResolved(true)}
                />

                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase text-slate-400">
                    What do you need help with?
                  </Label>
                  <Select value={ticketTypeId} onValueChange={setTicketTypeId}>
                    <SelectTrigger className="h-11 border-slate-100 bg-slate-50/50">
                      <SelectValue placeholder="Select request type" />
                    </SelectTrigger>
                    <SelectContent>
                      {ticketTypes.map((type) => (
                        <SelectItem key={type.id} value={type.id}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedType?.showEquipment ? (
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase text-slate-400">
                      Related {terminology?.equipment?.toLowerCase() ?? 'asset'} (optional)
                    </Label>
                    <Select value={equipmentId} onValueChange={setEquipmentId}>
                      <SelectTrigger className="h-11 border-slate-100 bg-slate-50/50">
                        <SelectValue placeholder="Select an asset…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="GENERAL">General / not asset-specific</SelectItem>
                        {equipmentOptions?.map((opt: { id: string; label: string }) => (
                          <SelectItem key={opt.id} value={opt.id}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}

                {selectedType?.showProduct ? (
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase text-slate-400">
                      Related product (optional)
                    </Label>
                    <Select
                      value={customFields.productId ?? ''}
                      onValueChange={(value) =>
                        setCustomFields((prev) => ({ ...prev, productId: value }))
                      }
                    >
                      <SelectTrigger className="h-11 border-slate-100 bg-slate-50/50">
                        <SelectValue placeholder="Select a product…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Not product-specific</SelectItem>
                        {(Array.isArray(productOptions) ? productOptions : []).map(
                          (opt: { id: string; name: string }) => (
                            <SelectItem key={opt.id} value={opt.id}>
                              {opt.name}
                            </SelectItem>
                          )
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}

                {selectedType?.fields.map((field) => (
                  <div key={field.id} className="space-y-2">
                    <Label htmlFor={field.id} className="text-xs font-bold uppercase text-slate-400">
                      {field.label}
                      {field.required ? ' *' : ''}
                    </Label>
                    <DynamicField
                      field={field}
                      value={customFields[field.id] ?? ''}
                      onChange={(value) =>
                        setCustomFields((prev) => ({ ...prev, [field.id]: value }))
                      }
                    />
                  </div>
                ))}

                <div className="space-y-2">
                  <Label htmlFor="subject" className="text-xs font-bold uppercase text-slate-400">
                    Summary
                  </Label>
                  <Input
                    id="subject"
                    placeholder="Brief summary of your request"
                    className="h-11 border-slate-100 bg-slate-50/50"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="priority" className="text-xs font-bold uppercase text-slate-400">
                    Priority
                  </Label>
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger className="h-11 border-slate-100 bg-slate-50/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LOW">Low — general question</SelectItem>
                      <SelectItem value="MEDIUM">Medium — needs attention</SelectItem>
                      <SelectItem value="HIGH">High — business impact</SelectItem>
                      <SelectItem value="CRITICAL">Critical — outage or safety</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description" className="text-xs font-bold uppercase text-slate-400">
                    Details
                  </Label>
                  <Textarea
                    id="description"
                    placeholder="Describe the issue, steps to reproduce, or what you need…"
                    className="min-h-[160px] resize-none border-slate-100 bg-slate-50/50"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    required
                  />
                </div>

                <div className="flex justify-end gap-3 border-t border-slate-50 pt-6">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => router.push('/portal/tickets')}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="min-w-[160px] bg-blue-600 hover:bg-blue-700"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Submitting…
                      </>
                    ) : (
                      <>
                        Submit {ticketLabel.toLowerCase()}
                        <Send className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="relative overflow-hidden border-none bg-slate-900 text-white shadow-none dark:bg-slate-800">
            <CardHeader>
              <CardTitle className="text-base">Request types</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {ticketTypes.map((type) => (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => setTicketTypeId(type.id)}
                  className={`w-full rounded-md border p-3 text-left transition-colors ${
                    ticketTypeId === type.id
                      ? 'border-blue-400 bg-blue-500/20'
                      : 'border-white/10 bg-white/5 hover:bg-white/10'
                  }`}
                >
                  <p className="text-sm font-semibold">{type.label}</p>
                  <p className="mt-1 text-xs text-slate-300">{type.description}</p>
                </button>
              ))}
            </CardContent>
          </Card>

          <Card className="border-none bg-blue-50/50 shadow-none dark:bg-blue-900/10">
            <CardContent className="flex items-start gap-3 pt-6">
              <Sparkles className="mt-0.5 h-4 w-4 text-blue-600" />
              <p className="text-xs leading-relaxed text-blue-800 dark:text-blue-200">
                Requests are routed to the right team based on category. You can track updates
                from your {ticketLabel.toLowerCase()} list.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
