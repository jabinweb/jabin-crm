'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Copy, KeyRound, Loader2, Plus, ShieldAlert, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { confirmAction } from '@/lib/confirm-action';
import type { McpTokenView } from '@/lib/mcp/token-store';

const TOKEN_PLACEHOLDER = '<your-token>';

function mcpEndpoint() {
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, '') ||
    (typeof window !== 'undefined' ? window.location.origin : '');
  return `${base}/api/mcp`;
}

function formatDate(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function CopyBlock({ label, text }: { label?: string; text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Copy failed — select the text and copy it manually');
    }
  };
  return (
    <div className="space-y-1.5">
      {label ? <p className="text-xs font-medium text-muted-foreground">{label}</p> : null}
      <div className="relative">
        <pre className="max-w-full overflow-x-auto whitespace-pre-wrap break-all rounded-md border bg-muted/50 p-3 pr-11 font-mono text-xs">
          {text}
        </pre>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-1.5 top-1.5 h-7 w-7"
          aria-label="Copy"
          onClick={() => void copy()}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </div>
  );
}

function SetupSnippets({ token }: { token: string }) {
  const endpoint = mcpEndpoint();
  const header = `Bearer ${token}`;
  const claudeCode = `claude mcp add --transport http opslane ${endpoint} --header "Authorization: ${header}"`;
  const claudeDesktop = JSON.stringify(
    {
      mcpServers: {
        opslane: {
          command: 'npx',
          args: ['-y', 'mcp-remote', endpoint, '--header', 'Authorization:${OPSLANE_AUTH}'],
          env: { OPSLANE_AUTH: header },
        },
      },
    },
    null,
    2
  );
  const cursor = JSON.stringify(
    { mcpServers: { opslane: { url: endpoint, headers: { Authorization: header } } } },
    null,
    2
  );

  return (
    <Tabs defaultValue="claude-code" className="space-y-3">
      <TabsList className="flex h-auto w-full justify-start gap-1 overflow-x-auto no-scrollbar">
        <TabsTrigger value="claude-code">Claude Code</TabsTrigger>
        <TabsTrigger value="claude-desktop">Claude Desktop</TabsTrigger>
        <TabsTrigger value="cursor">Cursor</TabsTrigger>
        <TabsTrigger value="other">Other clients</TabsTrigger>
      </TabsList>
      <TabsContent value="claude-code" className="space-y-2">
        <CopyBlock label="Run in a terminal" text={claudeCode} />
      </TabsContent>
      <TabsContent value="claude-desktop" className="space-y-2">
        <CopyBlock
          label="Settings → Developer → Edit config (claude_desktop_config.json), then restart Claude. Needs Node.js."
          text={claudeDesktop}
        />
      </TabsContent>
      <TabsContent value="cursor" className="space-y-2">
        <CopyBlock label="~/.cursor/mcp.json (or .cursor/mcp.json in a project)" text={cursor} />
      </TabsContent>
      <TabsContent value="other" className="space-y-2">
        <CopyBlock label="Server URL (Streamable HTTP)" text={endpoint} />
        <CopyBlock label="Request header" text={`Authorization: ${header}`} />
      </TabsContent>
    </Tabs>
  );
}

/**
 * Personal MCP tokens: let AI clients (Claude, Cursor…) use this workspace with the
 * signed-in user's permissions. Saves straight to the API.
 */
export function McpTokens() {
  const { slug, workspaceFetch } = useWorkspacePaths();
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => ['mcp-tokens', slug] as const, [slug]);

  const [name, setName] = useState('');
  const [scope, setScope] = useState<'read' | 'read_write'>('read');
  const [expiresInDays, setExpiresInDays] = useState('90');
  const [created, setCreated] = useState<{ token: string; name: string } | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await workspaceFetch('/api/integrations/mcp-tokens');
      if (!res.ok) throw new Error('Failed to load tokens');
      return (await res.json()) as { tokens: McpTokenView[] };
    },
    enabled: !!slug,
  });
  const tokens = data?.tokens ?? [];

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await workspaceFetch('/api/integrations/mcp-tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          scope,
          expiresInDays: Number(expiresInDays),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Could not create token');
      return body as { token: string; tokenInfo: McpTokenView };
    },
    onSuccess: (body) => {
      setCreated({ token: body.token, name: body.tokenInfo.name });
      setName('');
      void queryClient.invalidateQueries({ queryKey });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revoke = async (token: McpTokenView) => {
    const ok = await confirmAction({
      title: `Revoke “${token.name}”?`,
      description: 'Any AI client using this token loses access immediately.',
      confirmLabel: 'Revoke',
      variant: 'destructive',
    });
    if (!ok) return;
    const res = await workspaceFetch(`/api/integrations/mcp-tokens/${token.id}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      toast.error('Could not revoke the token');
      return;
    }
    toast.success('Token revoked');
    void queryClient.invalidateQueries({ queryKey });
  };

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Connect Claude, Cursor or any other MCP client to this workspace. The client acts as you:
        it sees only what your role and plan allow. Read-only tokens can look things up; read &
        write tokens can also create and update records — your AI client asks before each change.
      </p>

      {created ? (
        <div className="space-y-4 rounded-lg border border-primary/40 bg-primary/5 p-4">
          <div className="flex items-start gap-2">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-medium">Copy “{created.name}” now — it won’t be shown again</p>
              <p className="text-xs text-muted-foreground">
                Treat it like a password. If it leaks, revoke it below.
              </p>
            </div>
          </div>
          <CopyBlock text={created.token} />
          <SetupSnippets token={created.token} />
          <Button type="button" size="sm" variant="outline" onClick={() => setCreated(null)}>
            Done
          </Button>
        </div>
      ) : null}

      {isLoading ? (
        <Skeleton className="h-16 w-full rounded-lg" />
      ) : isError ? (
        <p className="text-sm text-destructive">Tokens could not be loaded.</p>
      ) : tokens.length ? (
        <ul className="divide-y rounded-lg border">
          {tokens.map((token) => (
            <li key={token.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="truncate text-sm font-medium">{token.name}</span>
                  <Badge variant={token.scope === 'read_write' ? 'default' : 'secondary'} className="text-[10px]">
                    {token.scope === 'read_write' ? 'Read & write' : 'Read only'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {token.hint} · created {formatDate(token.createdAt)} · expires{' '}
                  {formatDate(token.expiresAt)} ·{' '}
                  {token.lastUsedAt ? `last used ${formatDate(token.lastUsedAt)}` : 'never used'}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                aria-label={`Revoke ${token.name}`}
                onClick={() => void revoke(token)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No tokens yet.</p>
      )}

      <div className="space-y-3 rounded-lg border border-dashed p-4">
        <p className="text-sm font-medium">Create a token</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="mcp-token-name">Name</Label>
            <Input
              id="mcp-token-name"
              value={name}
              maxLength={60}
              onChange={(e) => setName(e.target.value)}
              placeholder="Claude on my laptop"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mcp-token-scope">Access</Label>
            <Select value={scope} onValueChange={(v) => setScope(v === 'read_write' ? 'read_write' : 'read')}>
              <SelectTrigger id="mcp-token-scope">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="read">Read only</SelectItem>
                <SelectItem value="read_write">Read & write</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mcp-token-expiry">Expires after</Label>
            <Select value={expiresInDays} onValueChange={setExpiresInDays}>
              <SelectTrigger id="mcp-token-expiry">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">30 days</SelectItem>
                <SelectItem value="90">90 days</SelectItem>
                <SelectItem value="365">1 year</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          disabled={createMutation.isPending || !slug}
          onClick={() => createMutation.mutate()}
        >
          {createMutation.isPending ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Plus className="mr-1.5 h-4 w-4" />
          )}
          Create token
        </Button>
      </div>

      {!created ? (
        <div className="space-y-2">
          <p className="text-sm font-medium">Setup</p>
          <p className="text-xs text-muted-foreground">
            Replace {TOKEN_PLACEHOLDER} with a token. New tokens show these with the token filled in.
          </p>
          <SetupSnippets token={TOKEN_PLACEHOLDER} />
        </div>
      ) : null}
    </div>
  );
}
