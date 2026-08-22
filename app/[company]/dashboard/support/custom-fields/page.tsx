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
import { Trash2 } from 'lucide-react';

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

  const { data: fields, isLoading } = useQuery({
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
      <div className="flex items-center gap-3">
        <SupportBackLink />
        <div>
          <h1 className="text-2xl font-bold">Custom fields</h1>
          <p className="text-sm text-muted-foreground">
            Extra fields on support tickets
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add field</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Name</Label>
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!key) setKey(e.target.value.toLowerCase().replace(/\s+/g, '_'));
              }}
              placeholder="Contract ID"
            />
          </div>
          <div>
            <Label>Key</Label>
            <Input
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="contract_id"
            />
          </div>
          <div>
            <Label>Type</Label>
            <Select value={fieldType} onValueChange={setFieldType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Text</SelectItem>
                <SelectItem value="number">Number</SelectItem>
                <SelectItem value="select">Select</SelectItem>
                <SelectItem value="boolean">Boolean</SelectItem>
                <SelectItem value="date">Date</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {fieldType === 'select' ? (
            <div>
              <Label>Options (comma-separated)</Label>
              <Input
                value={options}
                onChange={(e) => setOptions(e.target.value)}
                placeholder="A, B, C"
              />
            </div>
          ) : null}
          <div className="flex items-center gap-2">
            <Switch checked={required} onCheckedChange={setRequired} id="req" />
            <Label htmlFor="req">Required</Label>
          </div>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!name || createMutation.isPending}
          >
            Create
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
          ) : (
            fields?.map((f) => (
              <div
                key={f.id}
                className="flex items-center justify-between gap-3 border rounded-lg p-3"
              >
                <div>
                  <p className="font-medium text-sm">{f.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {f.key} · {f.fieldType}
                    {f.required ? ' · required' : ''}
                  </p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-destructive"
                  onClick={() => {
                    if (window.confirm(`Remove “${f.name}”?`)) {
                      deleteMutation.mutate(f.id);
                    }
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))
          )}
          {!isLoading && !fields?.length ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No custom fields yet
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
