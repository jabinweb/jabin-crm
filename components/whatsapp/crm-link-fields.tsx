'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, X } from 'lucide-react';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { cn } from '@/lib/utils';

type LinkKind = 'lead' | 'customer' | 'ticket';

type CrmLinkFieldsProps = {
  leadId: string;
  customerId: string;
  ticketId: string;
  onChange: (next: { leadId?: string; customerId?: string; ticketId?: string }) => void;
};

function useDebounced(value: string, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function PickerRow({
  kind,
  label,
  valueId,
  valueLabel,
  onPick,
  onClear,
}: {
  kind: LinkKind;
  label: string;
  valueId: string;
  valueLabel?: string;
  onPick: (id: string, label: string) => void;
  onClear: () => void;
}) {
  const { workspaceFetch } = useWorkspacePaths();
  const [q, setQ] = useState('');
  const debounced = useDebounced(q);
  const [open, setOpen] = useState(false);

  const { data: results = [], isFetching } = useQuery({
    queryKey: ['wa-crm-link', kind, debounced],
    enabled: open && debounced.trim().length >= 1,
    queryFn: async () => {
      const term = debounced.trim();
      if (kind === 'lead') {
        const res = await workspaceFetch(
          `/api/leads?query=${encodeURIComponent(term)}&limit=8`
        );
        if (!res.ok) return [];
        const body = await res.json();
        const leads = body.leads || body.data || (Array.isArray(body) ? body : []);
        return leads.map((l: { id: string; companyName?: string; contactName?: string }) => ({
          id: l.id,
          label: l.companyName || l.contactName || l.id,
          sub: l.contactName || undefined,
        }));
      }
      if (kind === 'customer') {
        const res = await workspaceFetch(
          `/api/customers?search=${encodeURIComponent(term)}&limit=8`
        );
        if (!res.ok) return [];
        const body = await res.json();
        const customers = body.customers || body.data || (Array.isArray(body) ? body : []);
        return customers.map(
          (c: { id: string; organizationName?: string; contactPerson?: string }) => ({
            id: c.id,
            label: c.organizationName || c.id,
            sub: c.contactPerson || undefined,
          })
        );
      }
      const res = await workspaceFetch(
        `/api/tickets?q=${encodeURIComponent(term)}&limit=8`
      );
      if (!res.ok) return [];
      const tickets = await res.json();
      return (Array.isArray(tickets) ? tickets : []).map(
        (t: { id: string; subject?: string; customer?: { organizationName?: string } }) => ({
          id: t.id,
          label: t.subject || t.id,
          sub: t.customer?.organizationName,
        })
      );
    },
  });

  return (
    <div className="relative space-y-1">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      {valueId ? (
        <div className="flex items-center gap-1">
          <Badge variant="secondary" className="max-w-full truncate font-normal">
            {valueLabel || valueId.slice(0, 10)}
          </Badge>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-6 w-6 shrink-0"
            onClick={onClear}
            title="Clear"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <Input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            // allow click on results
            setTimeout(() => setOpen(false), 150);
          }}
          placeholder={`Search ${label.toLowerCase()}…`}
          className="h-7 text-xs"
        />
      )}
      {open && !valueId && debounced.trim().length >= 1 ? (
        <div
          className={cn(
            'absolute z-20 mt-0.5 max-h-40 w-full overflow-auto rounded-md border bg-popover shadow-md'
          )}
        >
          {isFetching ? (
            <div className="flex items-center gap-2 px-2 py-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Searching…
            </div>
          ) : results.length === 0 ? (
            <p className="px-2 py-2 text-xs text-muted-foreground">No matches</p>
          ) : (
            results.map((r: { id: string; label: string; sub?: string }) => (
              <button
                key={r.id}
                type="button"
                className="flex w-full flex-col items-start px-2 py-1.5 text-left text-xs hover:bg-muted"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onPick(r.id, r.label);
                  setQ('');
                  setOpen(false);
                }}
              >
                <span className="font-medium line-clamp-1">{r.label}</span>
                {r.sub ? (
                  <span className="text-[10px] text-muted-foreground line-clamp-1">{r.sub}</span>
                ) : null}
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

export function CrmLinkFields({ leadId, customerId, ticketId, onChange }: CrmLinkFieldsProps) {
  const [labels, setLabels] = useState<{ lead?: string; customer?: string; ticket?: string }>({});

  return (
    <div className="grid gap-2 pt-1 sm:grid-cols-3">
      <PickerRow
        kind="lead"
        label="Lead"
        valueId={leadId}
        valueLabel={labels.lead}
        onPick={(id, label) => {
          setLabels((s) => ({ ...s, lead: label }));
          onChange({ leadId: id });
        }}
        onClear={() => {
          setLabels((s) => ({ ...s, lead: undefined }));
          onChange({ leadId: '' });
        }}
      />
      <PickerRow
        kind="customer"
        label="Customer"
        valueId={customerId}
        valueLabel={labels.customer}
        onPick={(id, label) => {
          setLabels((s) => ({ ...s, customer: label }));
          onChange({ customerId: id });
        }}
        onClear={() => {
          setLabels((s) => ({ ...s, customer: undefined }));
          onChange({ customerId: '' });
        }}
      />
      <PickerRow
        kind="ticket"
        label="Ticket"
        valueId={ticketId}
        valueLabel={labels.ticket}
        onPick={(id, label) => {
          setLabels((s) => ({ ...s, ticket: label }));
          onChange({ ticketId: id });
        }}
        onClear={() => {
          setLabels((s) => ({ ...s, ticket: undefined }));
          onChange({ ticketId: '' });
        }}
      />
    </div>
  );
}
