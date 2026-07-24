'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import {
  ALL_PIPELINE_KINDS,
  PIPELINE_KIND_LABELS,
  type PipelineKind,
  type PipelineStageDef,
} from '@/lib/pipelines';
import { ArrowDown, ArrowUp, Loader2, Save } from 'lucide-react';
import { FormSkeleton } from '@/components/loading';

type KindState = {
  stages: string[];
  labels: Record<string, string>;
  available: PipelineStageDef[];
  label: string;
};

export function PipelineSettingsPanel() {
  const { workspaceFetch } = useWorkspacePaths();
  const [active, setActive] = useState<PipelineKind>('leads');
  const [byKind, setByKind] = useState<Partial<Record<PipelineKind, KindState>>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await workspaceFetch('/api/workspace/pipelines');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      const next: Partial<Record<PipelineKind, KindState>> = {};
      for (const kind of ALL_PIPELINE_KINDS) {
        const entry = data.pipelines?.[kind];
        if (!entry) continue;
        next[kind] = {
          stages: entry.stages,
          labels: entry.labels ?? {},
          available: entry.available,
          label: entry.label || PIPELINE_KIND_LABELS[kind],
        };
      }
      setByKind(next);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load pipelines');
    } finally {
      setLoading(false);
    }
  }, [workspaceFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  const current = byKind[active];

  const toggleStage = (id: string, enabled: boolean) => {
    setByKind((prev) => {
      const cur = prev[active];
      if (!cur) return prev;
      let stages = [...cur.stages];
      if (enabled) {
        if (!stages.includes(id)) stages.push(id);
      } else {
        stages = stages.filter((s) => s !== id);
      }
      if (stages.length === 0) {
        toast.error('Keep at least one stage');
        return prev;
      }
      return { ...prev, [active]: { ...cur, stages } };
    });
  };

  const move = (id: string, dir: -1 | 1) => {
    setByKind((prev) => {
      const cur = prev[active];
      if (!cur) return prev;
      const stages = [...cur.stages];
      const idx = stages.indexOf(id);
      if (idx < 0) return prev;
      const next = idx + dir;
      if (next < 0 || next >= stages.length) return prev;
      ;[stages[idx], stages[next]] = [stages[next], stages[idx]];
      return { ...prev, [active]: { ...cur, stages } };
    });
  };

  const setLabel = (id: string, label: string) => {
    setByKind((prev) => {
      const cur = prev[active];
      if (!cur) return prev;
      const labels = { ...cur.labels };
      const trimmed = label.trim();
      const def = cur.available.find((a) => a.id === id);
      if (!trimmed || (def && trimmed === def.label)) {
        delete labels[id];
      } else {
        labels[id] = trimmed.slice(0, 64);
      }
      return { ...prev, [active]: { ...cur, labels } };
    });
  };

  const save = async () => {
    if (!current) return;
    setSaving(true);
    try {
      const res = await workspaceFetch('/api/workspace/pipelines', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: active,
          stages: current.stages,
          labels: current.labels,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      toast.success(`${PIPELINE_KIND_LABELS[active]} pipeline saved`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <FormSkeleton fields={5} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {ALL_PIPELINE_KINDS.map((kind) => (
          <Button
            key={kind}
            type="button"
            size="sm"
            variant={active === kind ? 'default' : 'outline'}
            onClick={() => setActive(kind)}
          >
            {PIPELINE_KIND_LABELS[kind]}
          </Button>
        ))}
      </div>

      {current && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{current.label} stages</CardTitle>
            <CardDescription>
              Enable stages, rename column labels, and reorder the board. Values stay within the
              system status set.
              {active === 'tickets' && (
                <>
                  {' '}
                  Per–ticket-type status pipelines remain under Support settings (type filters);
                  this controls the global board columns.
                </>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Board column order</Label>
              {current.stages.map((id) => {
                const def = current.available.find((a) => a.id === id);
                return (
                  <div
                    key={id}
                    className="flex flex-col gap-2 rounded-md border px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex flex-1 items-center gap-2 min-w-0">
                      <div className={`h-2.5 w-2.5 shrink-0 rounded-full ${def?.color || 'bg-muted'}`} />
                      <Input
                        className="h-8"
                        value={current.labels[id] ?? def?.label ?? id}
                        onChange={(e) => setLabel(id, e.target.value)}
                        aria-label={`Label for ${id}`}
                      />
                      <span className="hidden text-[10px] text-muted-foreground sm:inline">
                        {id}
                      </span>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => move(id, -1)}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => move(id, 1)}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="space-y-2 border-t pt-4">
              <Label className="text-xs text-muted-foreground">Available stages</Label>
              {current.available.map((stage) => {
                const on = current.stages.includes(stage.id);
                return (
                  <div key={stage.id} className="flex items-center justify-between py-1.5">
                    <div className="flex items-center gap-2">
                      <div className={`h-2.5 w-2.5 rounded-full ${stage.color}`} />
                      <span className="text-sm">{stage.label}</span>
                    </div>
                    <Switch
                      checked={on}
                      onCheckedChange={(v) => toggleStage(stage.id, v)}
                    />
                  </div>
                );
              })}
            </div>

            <Button type="button" onClick={() => void save()} disabled={saving}>
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save {current.label.toLowerCase()} pipeline
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
