'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Download, Loader2, Upload } from 'lucide-react';
import type {
  ColumnMapping,
  ExecuteResult,
  FieldDef,
  MigrationObject,
  PreviewResult,
} from '@/lib/migration/types';

const OBJECT_OPTIONS: { id: MigrationObject; label: string; hint: string }[] = [
  {
    id: 'leads',
    label: 'Leads',
    hint: 'Prospects and pipeline contacts from HubSpot, Salesforce, etc.',
  },
  {
    id: 'customers',
    label: 'Customers',
    hint: 'Accounts / organizations you support',
  },
  {
    id: 'tickets',
    label: 'Tickets',
    hint: 'Support tickets (Freshdesk, Zendesk). Match customers by email.',
  },
];

const STEPS = ['Object', 'Upload', 'Map', 'Preview', 'Import'] as const;

export function MigrationWizard() {
  const { workspaceFetch } = useWorkspacePaths();
  const [step, setStep] = useState(0);
  const [object, setObject] = useState<MigrationObject>('leads');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [createMissingCustomers, setCreateMissingCustomers] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ExecuteResult | null>(null);

  const progress = ((step + 1) / STEPS.length) * 100;

  const requiredGaps = useMemo(() => {
    if (!preview) return [];
    return preview.fields.filter((f) => f.required && !mapping[f.key]).map((f) => f.key);
  }, [preview, mapping]);

  const downloadTemplate = async () => {
    try {
      const res = await workspaceFetch(`/api/migration/template?object=${object}`);
      if (!res.ok) throw new Error('Failed to download template');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `opslane-${object}-template.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Download failed');
    }
  };

  const runPreview = async () => {
    if (!file) {
      toast.error('Select a CSV file first');
      return;
    }
    setBusy(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('object', object);
      const res = await workspaceFetch('/api/migration/preview', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Preview failed');
      setPreview(data as PreviewResult);
      setMapping(data.autoMap as ColumnMapping);
      setStep(2);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Preview failed');
    } finally {
      setBusy(false);
    }
  };

  const runImport = async () => {
    if (!file || !preview) return;
    if (requiredGaps.length) {
      toast.error(`Map required fields: ${requiredGaps.join(', ')}`);
      return;
    }
    setBusy(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('object', object);
      formData.append('mapping', JSON.stringify(mapping));
      if (object === 'tickets' && createMissingCustomers) {
        formData.append('createMissingCustomers', 'true');
      }
      const res = await workspaceFetch('/api/migration/execute', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed');
      setResult(data as ExecuteResult);
      setStep(4);
      toast.success(`Imported ${data.summary.imported} row(s)`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Import failed');
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setStep(0);
    setFile(null);
    setPreview(null);
    setMapping({});
    setResult(null);
    setCreateMissingCustomers(false);
  };

  const updateMapping = (fieldKey: string, header: string | null) => {
    setMapping((prev) => ({
      ...prev,
      [fieldKey]: header === '__none__' ? null : header,
    }));
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Data migration</h1>
        <p className="text-sm text-muted-foreground">
          Import leads, customers, or tickets from a CSV export (HubSpot, Freshdesk, etc.).
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>
            Step {step + 1} of {STEPS.length}: {STEPS[step]}
          </span>
          <span>{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} />
      </div>

      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">What are you importing?</CardTitle>
            <CardDescription>One object type per CSV file. Max 5,000 rows.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              {OBJECT_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setObject(opt.id)}
                  className={`text-left rounded-md border p-4 transition-colors ${
                    object === opt.id
                      ? 'border-primary bg-primary/5'
                      : 'hover:bg-muted/50'
                  }`}
                >
                  <div className="font-medium">{opt.label}</div>
                  <div className="text-sm text-muted-foreground">{opt.hint}</div>
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={downloadTemplate}>
                <Download className="mr-2 h-4 w-4" />
                Download {object} template
              </Button>
              <Button type="button" onClick={() => setStep(1)}>
                Continue
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upload CSV</CardTitle>
            <CardDescription>
              Export from your current CRM, then upload here. Headers are auto-detected.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="migration-csv">CSV file</Label>
              <input
                id="migration-csv"
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setFile(f);
                  setPreview(null);
                  setResult(null);
                }}
              />
              {file && (
                <p className="text-sm text-muted-foreground">
                  Selected: {file.name} ({Math.round(file.size / 1024)} KB)
                </p>
              )}
            </div>
            {object === 'tickets' && (
              <div className="flex items-center gap-2">
                <Switch
                  id="create-missing"
                  checked={createMissingCustomers}
                  onCheckedChange={setCreateMissingCustomers}
                />
                <Label htmlFor="create-missing" className="font-normal cursor-pointer">
                  Create stub customers when email is not found
                </Label>
              </div>
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setStep(0)}>
                Back
              </Button>
              <Button type="button" disabled={!file || busy} onClick={runPreview}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                Parse & map columns
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && preview && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Map columns</CardTitle>
            <CardDescription>
              {preview.totalRows} rows detected. Required fields must be mapped.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {preview.fields.map((field: FieldDef) => (
                <div
                  key={field.key}
                  className="grid gap-2 sm:grid-cols-[180px_1fr] sm:items-center"
                >
                  <Label className="text-sm">
                    {field.label}
                    {field.required ? <span className="text-destructive"> *</span> : null}
                  </Label>
                  <Select
                    value={mapping[field.key] ?? '__none__'}
                    onValueChange={(v) => updateMapping(field.key, v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Ignore" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— Ignore —</SelectItem>
                      {preview.headers.map((h) => (
                        <SelectItem key={h} value={h}>
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            {requiredGaps.length > 0 && (
              <p className="text-sm text-destructive">
                Map required: {requiredGaps.join(', ')}
              </p>
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button
                type="button"
                disabled={requiredGaps.length > 0}
                onClick={() => setStep(3)}
              >
                Preview rows
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && preview && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Preview</CardTitle>
            <CardDescription>First {preview.sampleRows.length} rows after mapping.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {preview.fields
                      .filter((f) => mapping[f.key])
                      .map((f) => (
                        <TableHead key={f.key}>{f.label}</TableHead>
                      ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.sampleRows.map((row, idx) => (
                    <TableRow key={idx}>
                      {preview.fields
                        .filter((f) => mapping[f.key])
                        .map((f) => {
                          const header = mapping[f.key];
                          const value = header ? row[header] : '';
                          return (
                            <TableCell key={f.key} className="max-w-[180px] truncate text-xs">
                              {value || '—'}
                            </TableCell>
                          );
                        })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setStep(2)}>
                Back
              </Button>
              <Button type="button" disabled={busy} onClick={runImport}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Run import
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 4 && result && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Import report</CardTitle>
            <CardDescription>
              {result.object} import finished.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Stat label="Total rows" value={result.summary.totalRows} />
              <Stat label="Imported" value={result.summary.imported} />
              <Stat label="Skipped duplicates" value={result.summary.skippedDuplicates} />
              <Stat label="Skipped missing fields" value={result.summary.skippedMissingRequired} />
              <Stat label="Skipped unresolved" value={result.summary.skippedUnresolved} />
              <Stat label="Failed" value={result.summary.failed} />
            </div>
            {result.errors.length > 0 && (
              <div className="rounded-md border p-3 space-y-1 max-h-48 overflow-y-auto">
                <p className="text-sm font-medium">Errors</p>
                {result.errors.slice(0, 50).map((err, i) => (
                  <p key={i} className="text-xs text-muted-foreground">
                    Row {err.row}: {err.message}
                  </p>
                ))}
              </div>
            )}
            <Button type="button" onClick={reset}>
              Start another import
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
