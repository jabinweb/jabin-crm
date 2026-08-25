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

  const { data, isLoading } = useQuery({
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
      toast.success('Template saved');
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">HR letters</h1>
          <p className="text-sm text-muted-foreground">
            Templates with {'{{name}}'}, {'{{employeeId}}'}, {'{{jobTitle}}'}, {'{{department}}'},{' '}
            {'{{date}}'}.
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
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : letters.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No letters issued yet"
              description="Create a template, then issue a letter to an employee."
              actionLabel="Issue letter"
              onAction={() => {
                resetIssueForm();
                setIssueDialogOpen(true);
              }}
            />
          ) : (
            letters.map((l) => (
              <div key={l.id} className="rounded-lg border p-3">
                <p className="font-medium">
                  {l.title} — {l.employee.name}
                </p>
                <pre className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">{l.body}</pre>
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
              Save a reusable letter template with placeholder tokens.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={tplName} onChange={(e) => setTplName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Body</Label>
              <Textarea rows={8} value={tplBody} onChange={(e) => setTplBody(e.target.value)} />
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
              <Label>Employee</Label>
              <select
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
              >
                <option value="">Select…</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name} ({e.employeeId})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Template</Label>
              <select
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
              >
                <option value="">Select…</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
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
              Issue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
