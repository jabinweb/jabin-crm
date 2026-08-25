'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useSettings } from '@/contexts/settings-context';
import type { SettingsUpdatePayload } from '@/types/settings';
import {
  defaultProjectTaskStatuses,
  type ProjectTaskStatusDef,
} from '@/lib/projects/task-statuses';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';

function toId(label: string) {
  return label
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40);
}

function withOrder(list: ProjectTaskStatusDef[]): ProjectTaskStatusDef[] {
  return list.map((s, i) => ({ ...s, order: i }));
}

export function ProjectTaskStatusesSection({
  onChange,
}: {
  onChange: (changes: SettingsUpdatePayload) => void;
}) {
  const { settings } = useSettings();
  const [draftLabel, setDraftLabel] = useState('');

  const statuses = useMemo(() => {
    const raw = (settings as Record<string, unknown> | null)?.projectTaskStatuses;
    if (Array.isArray(raw) && raw.length > 0) {
      const parsed = raw
        .filter((s): s is ProjectTaskStatusDef => !!s && typeof s === 'object')
        .map((s, i) => ({
          id: String((s as ProjectTaskStatusDef).id || ''),
          label: String((s as ProjectTaskStatusDef).label || ''),
          color: (s as ProjectTaskStatusDef).color,
          order:
            typeof (s as ProjectTaskStatusDef).order === 'number'
              ? (s as ProjectTaskStatusDef).order
              : i,
          isDone:
            (s as ProjectTaskStatusDef).isDone === true ||
            String((s as ProjectTaskStatusDef).id || '') === 'DONE',
        }))
        .filter((s) => s.id && s.label)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      if (parsed.length) return withOrder(parsed);
    }
    return defaultProjectTaskStatuses();
  }, [settings]);

  const update = (next: ProjectTaskStatusDef[]) => {
    onChange({
      settings: {
        projectTaskStatuses: withOrder(next),
      } as SettingsUpdatePayload['settings'],
    });
  };

  const addStatus = () => {
    const label = draftLabel.trim();
    if (!label) return;
    const id = toId(label);
    if (!id || statuses.some((s) => s.id === id)) return;
    update([...statuses, { id, label, isDone: false }]);
    setDraftLabel('');
  };

  const removeStatus = (id: string) => {
    if (statuses.length <= 1) return;
    update(statuses.filter((s) => s.id !== id));
  };

  const rename = (id: string, label: string) => {
    update(statuses.map((s) => (s.id === id ? { ...s, label } : s)));
  };

  const toggleDone = (id: string, isDone: boolean) => {
    update(statuses.map((s) => (s.id === id ? { ...s, isDone } : s)));
  };

  const move = (index: number, dir: -1 | 1) => {
    const next = [...statuses];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    const tmp = next[index]!;
    next[index] = next[target]!;
    next[target] = tmp;
    update(next);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Project task statuses</CardTitle>
        <CardDescription>
          Columns on delivery boards. Mark statuses as Done so project progress
          counts them. Reorder with the arrows.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-2">
          {statuses.map((s, index) => (
            <li key={s.id} className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-0.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                  aria-label="Move up"
                >
                  <ArrowUp className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  disabled={index === statuses.length - 1}
                  onClick={() => move(index, 1)}
                  aria-label="Move down"
                >
                  <ArrowDown className="size-3.5" />
                </Button>
              </div>
              <Input
                value={s.label}
                onChange={(e) => rename(s.id, e.target.value)}
                className="max-w-xs"
              />
              <span className="text-xs text-muted-foreground font-mono">{s.id}</span>
              <div className="flex items-center gap-2">
                <Switch
                  id={`done-${s.id}`}
                  checked={!!s.isDone}
                  onCheckedChange={(checked) => toggleDone(s.id, checked)}
                />
                <Label htmlFor={`done-${s.id}`} className="text-xs text-muted-foreground">
                  Done
                </Label>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 text-destructive"
                disabled={statuses.length <= 1}
                onClick={() => removeStatus(s.id)}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-end gap-2">
          <div className="grid gap-1.5">
            <Label htmlFor="new-task-status">Add status</Label>
            <Input
              id="new-task-status"
              placeholder="e.g. Blocked"
              value={draftLabel}
              onChange={(e) => setDraftLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addStatus();
                }
              }}
            />
          </div>
          <Button type="button" variant="secondary" onClick={addStatus}>
            <Plus className="mr-1.5 size-3.5" />
            Add
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => update(defaultProjectTaskStatuses())}
          >
            Reset defaults
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
