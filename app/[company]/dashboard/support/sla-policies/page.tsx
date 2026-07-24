'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Clock, Save } from 'lucide-react';
import { toast } from 'sonner';
import { FeatureModuleGuard } from '@/components/feature-module-guard';
import { SupportBackLink } from '@/components/support/support-back-link';
import { FormSkeleton, PageHeaderSkeleton } from '@/components/loading';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

export default function SlaPoliciesPage() {
  const queryClient = useQueryClient();
  const { slug, workspaceFetch } = useWorkspacePaths();
  const [edits, setEdits] = useState<Record<string, { name: string; responseHours: number; resolutionHours: number }>>({});

  const { data, isLoading } = useQuery({
    queryKey: ['sla-policies', slug],
    queryFn: async () => {
      const res = await workspaceFetch('/api/support/sla-policies');
      if (!res.ok) throw new Error('Failed to load');
      return res.json();
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: {
      priority: string;
      name: string;
      responseHours: number;
      resolutionHours: number;
    }) => {
      const res = await workspaceFetch('/api/support/sla-policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Save failed');
      return res.json();
    },
    onSuccess: () => {
      toast.success('SLA policy saved');
      queryClient.invalidateQueries({ queryKey: ['sla-policies'] });
    },
    onError: () => toast.error('Could not save policy'),
  });

  const policies = data?.policies ?? [];
  const byPriority = Object.fromEntries(
    policies.map((p: { priority: string; name: string; responseHours: number; resolutionHours: number; companyId: string | null }) => [
      p.priority,
      p,
    ])
  );

  const getEdit = (priority: string) => {
    if (edits[priority]) return edits[priority];
    const p = byPriority[priority];
    return {
      name: p?.name ?? `${priority} SLA`,
      responseHours: p?.responseHours ?? 4,
      resolutionHours: p?.resolutionHours ?? 48,
    };
  };

  return (
    <FeatureModuleGuard module="SUPPORT_SLA">
      {isLoading ? (
        <div className="space-y-8 max-w-3xl">
          <PageHeaderSkeleton />
          <div className="space-y-4">
            {PRIORITIES.map((priority) => (
              <Card key={priority}>
                <CardContent className="pt-6">
                  <FormSkeleton fields={3} />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : (
    <div className="space-y-8 max-w-3xl">
      <div className="flex items-center gap-4">
        <SupportBackLink />
      </div>

      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Clock className="h-8 w-8" />
          SLA policies
        </h1>
        <p className="text-muted-foreground mt-1">
          Configure first-response and resolution targets per priority. Tenant overrides replace global defaults.
        </p>
      </div>

      <div className="space-y-4">
        {PRIORITIES.map((priority) => {
          const edit = getEdit(priority);
          const tenantPolicy = policies.find(
            (p: { priority: string; companyId: string | null }) => p.priority === priority && p.companyId
          );
          return (
            <Card key={priority}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{priority}</CardTitle>
                  <Badge variant={tenantPolicy ? 'default' : 'secondary'}>
                    {tenantPolicy ? 'Tenant override' : 'Global default'}
                  </Badge>
                </div>
                <CardDescription>Targets used for SLA badges and escalation sweeps.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2 sm:col-span-3">
                  <Label>Policy name</Label>
                  <Input
                    value={edit.name}
                    onChange={(e) =>
                      setEdits((prev) => ({
                        ...prev,
                        [priority]: { ...edit, name: e.target.value },
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>First response (hours)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={edit.responseHours}
                    onChange={(e) =>
                      setEdits((prev) => ({
                        ...prev,
                        [priority]: { ...edit, responseHours: Number(e.target.value) },
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Resolution (hours)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={edit.resolutionHours}
                    onChange={(e) =>
                      setEdits((prev) => ({
                        ...prev,
                        [priority]: { ...edit, resolutionHours: Number(e.target.value) },
                      }))
                    }
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    className="w-full"
                    onClick={() =>
                      saveMutation.mutate({
                        priority,
                        name: edit.name,
                        responseHours: edit.responseHours,
                        resolutionHours: edit.resolutionHours,
                      })
                    }
                    disabled={saveMutation.isPending}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Save
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
      )}
    </FeatureModuleGuard>
  );
}
