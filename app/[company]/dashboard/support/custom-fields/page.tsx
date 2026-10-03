'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { SupportBackLink } from '@/components/support/support-back-link';
import { CardListSkeleton } from '@/components/loading';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { confirmAction } from '@/lib/confirm-action';
import { AlertTriangle, ListPlus, Loader2, Trash2 } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';

const FIELD_TYPE_LABELS: Record<string, string> = {
  text: 'Text',
  number: 'Number',
  select: 'Dropdown',
  boolean: 'Yes / no',
  date: 'Date',
};

type CustomField = {
  id: string;
  name: string;
  key: string;
  fieldType: string;
  required: boolean;
  sortOrder: number;
  options?: unknown;
};

export default function CustomFieldsPage() {
  const queryClient = useQueryClient();
  const { slug, workspaceFetch } = useWorkspacePaths();
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [fieldType, setFieldType] = useState('text');
  const [required, setRequired] = useState(false);
  const [options, setOptions] = useState('');

  const { data: fields, isLoading, isError, refetch } = useQuery({
    queryKey: ['ticket-custom-fields', slug],
    queryFn: async () => {
      const res = await workspaceFetch('/api/support/custom-fields');
      if (!res.ok) throw new Error('Failed to load');
      return res.json() as Promise<CustomField[]>;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await workspaceFetch('/api/support/custom-fields', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          key: key || undefined,
          fieldType,
          required,
          options:
            fieldType === 'select' && options.trim()
              ? options.split(',').map((o) => o.trim()).filter(Boolean)
              : null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create');
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success('Field created');
      setName('');
      setKey('');
      setFieldType('text');
      setRequired(false);
      setOptions('');
      queryClient.invalidateQueries({ queryKey: ['ticket-custom-fields'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await workspaceFetch(`/api/support/custom-fields?id=${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to delete');
      }
    },
    onSuccess: () => {
      toast.success('Field removed');
      queryClient.invalidateQueries({ queryKey: ['ticket-custom-fields'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex flex-col items-start">
        <SupportBackLink />
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">Custom fields</h1>
          <p className="text-sm text-muted-foreground">
            Capture extra details on every support ticket.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add field</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="cf-name">Name</Label>
            <Input
              id="cf-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!key) setKey(e.target.value.toLowerCase().replace(/\s+/g, '_'));
              }}
              placeholder="Contract ID"
            />
          </div>
          <div>
            <Label htmlFor="cf-key">Key</Label>
            <Input
              id="cf-key"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="contract_id"
              aria-describedby="cf-key-hint"
            />
            <p id="cf-key-hint" className="mt-1 text-xs text-muted-foreground">
              Used in integrations and exports. Filled in from the name automatically.
            </p>
          </div>
          <div>
            <Label htmlFor="cf-type">Type</Label>
            <Select value={fieldType} onValueChange={setFieldType}>
              <SelectTrigger id="cf-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Text</SelectItem>
                <SelectItem value="number">Number</SelectItem>
                <SelectItem value="select">Dropdown</SelectItem>
                <SelectItem value="boolean">Yes / no</SelectItem>
                <SelectItem value="date">Date</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {fieldType === 'select' ? (
            <div>
              <Label htmlFor="cf-options">Options (comma-separated)</Label>
              <Input
                value={options}
                onChange={(e) => setOptions(e.target.value)}
                id="cf-options"
                placeholder="Basic, Pro, Enterprise"
              />
            </div>
          ) : null}
          <div className="flex items-center gap-2">
            <Switch checked={required} onCheckedChange={setRequired} id="req" />
            <Label htmlFor="req">Required</Label>
          </div>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!name.trim() || createMutation.isPending}
          >
            {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Create field
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Active fields</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <CardListSkeleton rows={3} />
          ) : isError ? (
            <EmptyState
              icon={AlertTriangle}
              title="Couldn't load custom fields"
              description="Check your connection and try again."
              actionLabel="Try again"
              onAction={() => refetch()}
            />
          ) : (
            fields?.map((f) => (
              <div
                key={f.id}
                className="flex items-center justify-between gap-3 border rounded-lg p-3"
              >
                <div className="min-w-0">
                  <p className="font-medium text-sm break-words">{f.name}</p>
                  <p className="text-xs text-muted-foreground break-all">
                    {f.key} · {FIELD_TYPE_LABELS[f.fieldType] ?? f.fieldType}
                    {f.required ? ' · required' : ''}
                  </p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-10 w-10 sm:h-8 sm:w-8 text-destructive"
                  aria-label={`Remove ${f.name}`}
                  title="Remove"
                  onClick={async () => {
                    if (
                      !(await confirmAction({
                        title: `Remove “${f.name}”?`,
                        description: 'This cannot be undone.',
                        confirmLabel: 'Remove',
                        variant: 'destructive',
                      }))
                    )
                      return;
                    deleteMutation.mutate(f.id);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))
          )}
          {!isLoading && !isError && !fields?.length ? (
            <EmptyState
              icon={ListPlus}
              title="No custom fields yet"
              description="Add a field above — it will appear on every new ticket form."
              className="py-8"
            />
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
