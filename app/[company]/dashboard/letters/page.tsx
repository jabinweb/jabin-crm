'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { FileText, Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { CardListSkeleton } from '@/components/loading';
import { QueryErrorState } from '@/components/hr/hr-ui';

const SELECT_CLASS =
  'h-10 w-full rounded-md border border-input bg-background px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm';

const DEFAULT_BODY = `To whom it may concern,

This is to certify that {{name}} ({{employeeId}}) is employed with us as {{jobTitle}} in the {{department}} department.

Date: {{date}}`;

export default function LettersPage() {
  const qc = useQueryClient();
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [issueDialogOpen, setIssueDialogOpen] = useState(false);
  const [tplName, setTplName] = useState('Experience letter');
  const [tplBody, setTplBody] = useState(DEFAULT_BODY);
  const [employeeId, setEmployeeId] = useState('');
  const [templateId, setTemplateId] = useState('');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['hr-letters'],
    queryFn: async () => {
      const res = await fetch('/api/hr/letters');
      if (!res.ok) throw new Error('Failed');
      return res.json() as Promise<{
        templates: { id: string; name: string; body: string; type: string }[];
        letters: {
          id: string;
          title: string;
          body: string;
          issuedAt: string;
          employee: { name: string; employeeId: string };
        }[];
      }>;
    },
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['hr-directory-letters'],
    queryFn: async () => {
      const res = await fetch('/api/hr/directory');
      if (!res.ok) return [];
      return (await res.json()) as { id: string; name: string; employeeId: string }[];
    },
  });

  const resetTemplateForm = () => {
    setTplName('Experience letter');
    setTplBody(DEFAULT_BODY);
  };

  const resetIssueForm = () => {
    setEmployeeId('');
    setTemplateId('');
  };

  const createTpl = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/hr/letters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create_template', name: tplName, body: tplBody }),
      });
      if (!res.ok) throw new Error('Failed');
    },
    onSuccess: () => {
      toast.success(`Template “${tplName.trim()}” saved`);
      resetTemplateForm();
      setTemplateDialogOpen(false);
      void qc.invalidateQueries({ queryKey: ['hr-letters'] });
    },
    onError: () => toast.error('Failed to save template'),
  });

  const issue = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/hr/letters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'issue', employeeId, templateId }),
      });
      if (!res.ok) throw new Error('Failed');
    },
    onSuccess: () => {
      toast.success('Letter issued');
      resetIssueForm();
      setIssueDialogOpen(false);
      void qc.invalidateQueries({ queryKey: ['hr-letters'] });
    },
    onError: () => toast.error('Failed to issue letter'),
  });

  const letters = data?.letters || [];
  const templates = data?.templates || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">HR letters</h1>
          <p className="text-sm text-muted-foreground">
            Issue experience, employment and other letters from reusable templates.
            {templates.length > 0 &&
              ` ${templates.length} template${templates.length === 1 ? '' : 's'} saved.`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => {
              resetTemplateForm();
              setTemplateDialogOpen(true);
            }}
          >
            New template
          </Button>
          <Button
            onClick={() => {
              resetIssueForm();
              setIssueDialogOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Issue letter
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          {isLoading ? (
            <CardListSkeleton rows={3} />
          ) : isError ? (
            <QueryErrorState title="Couldn’t load letters" onRetry={() => void refetch()} />
          ) : letters.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No letters issued yet"
              description={
                templates.length === 0
                  ? 'Start by creating a template, then issue it to an employee.'
                  : 'Issue a letter to an employee from one of your templates.'
              }
              actionLabel={templates.length === 0 ? 'New template' : 'Issue letter'}
              onAction={() => {
                if (templates.length === 0) {
                  resetTemplateForm();
                  setTemplateDialogOpen(true);
                } else {
                  resetIssueForm();
                  setIssueDialogOpen(true);
                }
              }}
            />
          ) : (
            letters.map((l) => (
              <div key={l.id} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <p className="min-w-0 break-words font-medium">
                    {l.title} · {l.employee.name}
                  </p>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    Issued {format(new Date(l.issuedAt), 'd MMM yyyy')}
                  </span>
                </div>
                <details className="mt-2 group">
                  <summary className="cursor-pointer select-none py-1 text-sm text-primary hover:underline">
                    View letter
                  </summary>
                  <div className="mt-2 whitespace-pre-wrap break-words rounded-md bg-muted p-3 text-sm">
                    {l.body}
                  </div>
                </details>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Dialog
        open={templateDialogOpen}
        onOpenChange={(open) => {
          setTemplateDialogOpen(open);
          if (!open) resetTemplateForm();
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New template</DialogTitle>
            <DialogDescription>
              Save a reusable letter. Details are filled in for each employee when you issue it.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="tpl-name">Name</Label>
              <Input id="tpl-name" value={tplName} onChange={(e) => setTplName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tpl-body">Letter text</Label>
              <Textarea id="tpl-body" rows={8} value={tplBody} onChange={(e) => setTplBody(e.target.value)} />
              <p className="break-words text-xs text-muted-foreground">
                Placeholders: {'{{name}}'}, {'{{employeeId}}'}, {'{{jobTitle}}'}, {'{{department}}'},{' '}
                {'{{date}}'}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setTemplateDialogOpen(false);
                resetTemplateForm();
              }}
            >
              Cancel
            </Button>
            <Button
              disabled={!tplName.trim() || !tplBody.trim() || createTpl.isPending}
              onClick={() => createTpl.mutate()}
            >
              {createTpl.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={issueDialogOpen}
        onOpenChange={(open) => {
          setIssueDialogOpen(open);
          if (!open) resetIssueForm();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Issue letter</DialogTitle>
            <DialogDescription>
              Generate a letter for an employee from a saved template.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="issue-employee">Employee</Label>
              <select
                id="issue-employee"
                className={SELECT_CLASS}
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
              >
                <option value="">Select an employee</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name} ({e.employeeId})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="issue-template">Template</Label>
              <select
                id="issue-template"
                className={SELECT_CLASS}
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
              >
                <option value="">Select a template</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              {templates.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No templates yet.{' '}
                  <button
                    type="button"
                    className="text-primary underline"
                    onClick={() => {
                      setIssueDialogOpen(false);
                      resetTemplateForm();
                      setTemplateDialogOpen(true);
                    }}
                  >
                    Create one
                  </button>
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIssueDialogOpen(false);
                resetIssueForm();
              }}
            >
              Cancel
            </Button>
            <Button
              disabled={!employeeId || !templateId || issue.isPending}
              onClick={() => issue.mutate()}
            >
              {issue.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Issue letter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
