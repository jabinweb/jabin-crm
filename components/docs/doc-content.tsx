'use client';

import React, { useState } from 'react';
import { Check, Copy, AlertCircle, Info, CheckCircle2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Stable anchor id for a heading (shared with the page's "On this page" list). */
export function docAnchorId(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export function DocParagraph({ children }: { children: React.ReactNode }) {
  return <p className="text-[15px] leading-7 text-foreground/80">{children}</p>;
}

export function DocHeading({ level, children }: { level: 1 | 2 | 3 | 4; children: React.ReactNode }) {
  const classes = {
    1: 'text-2xl font-semibold tracking-tight mt-10 mb-3',
    2: 'text-xl font-semibold tracking-tight mt-10 mb-3',
    3: 'text-lg font-semibold tracking-tight mt-8 mb-2',
    4: 'text-base font-semibold mt-6 mb-2',
  };
  const Component = `h${level}` as React.ElementType;
  const id = typeof children === 'string' ? docAnchorId(children) : undefined;
  return (
    <Component id={id} className={cn('scroll-mt-24 text-foreground', classes[level])}>
      {children}
    </Component>
  );
}

export function DocList({ items, ordered = false }: { items: string[]; ordered?: boolean }) {
  const Component = ordered ? 'ol' : 'ul';
  return (
    <Component
      className={cn(
        'my-4 space-y-2 pl-6 text-[15px] marker:text-muted-foreground',
        ordered ? 'list-decimal' : 'list-disc'
      )}
    >
      {items.map((item, i) => (
        <li key={i} className="pl-1 leading-7 text-foreground/80">
          {item}
        </li>
      ))}
    </Component>
  );
}

export function DocCodeBlock({ code, language, title }: { code: string; language: string; title?: string }) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    void navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-6 overflow-hidden rounded-lg border bg-zinc-950 text-zinc-100 dark:bg-zinc-900">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
        <span className="text-xs font-medium text-zinc-400">{title || language}</span>
        <button
          type="button"
          onClick={copyToClipboard}
          className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-xs text-zinc-400 transition-colors hover:bg-white/10 hover:text-zinc-100"
          aria-label="Copy code"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 text-[13px] leading-6">
        <code className={`language-${language}`}>{code}</code>
      </pre>
    </div>
  );
}

const ALERT_STYLES = {
  info: { icon: Info, accent: 'border-l-sky-500', iconColor: 'text-sky-600 dark:text-sky-400' },
  success: { icon: CheckCircle2, accent: 'border-l-emerald-500', iconColor: 'text-emerald-600 dark:text-emerald-400' },
  warning: { icon: AlertTriangle, accent: 'border-l-amber-500', iconColor: 'text-amber-600 dark:text-amber-400' },
  error: { icon: AlertCircle, accent: 'border-l-red-500', iconColor: 'text-red-600 dark:text-red-400' },
} as const;

export function DocAlert({ type, title, message }: { type: 'info' | 'success' | 'warning' | 'error'; title?: string; message: string }) {
  const { icon: Icon, accent, iconColor } = ALERT_STYLES[type] ?? ALERT_STYLES.info;
  return (
    <div className={cn('my-6 flex gap-3 rounded-lg border border-l-4 bg-muted/40 p-4', accent)}>
      <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', iconColor)} aria-hidden />
      <div className="min-w-0 flex-1">
        {title ? <div className="mb-1 font-semibold text-foreground">{title}</div> : null}
        <div className="text-sm leading-6 text-foreground/75">{message}</div>
      </div>
    </div>
  );
}

/** URL paths ("/admin", "/{company}/dashboard + …") read better as code. */
function isPathCell(cell: string) {
  return cell.trim().startsWith('/');
}

export function DocTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    // Scrolls sideways inside its own box on narrow screens instead of breaking the page
    <div className="my-6 overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[520px] text-sm">
        <thead className="border-b bg-muted/50">
          <tr>
            {headers.map((header, i) => (
              <th key={i} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row, i) => (
            <tr key={i} className="align-top transition-colors hover:bg-muted/30">
              {row.map((cell, j) => (
                <td
                  key={j}
                  className={cn(
                    'px-4 py-3 leading-6',
                    j === 0 ? 'font-medium text-foreground' : 'text-foreground/75'
                  )}
                >
                  {isPathCell(cell) ? (
                    <span className="flex flex-wrap gap-1">
                      {cell.split(/\s+\+\s+/).map((part) => (
                        <code
                          key={part}
                          className="rounded bg-muted px-1.5 py-0.5 font-mono text-[12.5px] text-foreground"
                        >
                          {part}
                        </code>
                      ))}
                    </span>
                  ) : (
                    cell
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DocSteps({ steps }: { steps: Array<{ title: string; description: string }> }) {
  return (
    <ol className="my-6 space-y-0">
      {steps.map((step, i) => (
        <li key={i} className="relative flex gap-4 pb-6 last:pb-0">
          {i < steps.length - 1 ? (
            <span className="absolute left-[15px] top-8 h-[calc(100%-2rem)] w-px bg-border" aria-hidden />
          ) : null}
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-background text-sm font-semibold">
            {i + 1}
          </span>
          <div className="min-w-0 flex-1 pt-1">
            <div className="mb-1 font-semibold text-foreground">{step.title}</div>
            <div className="text-sm leading-6 text-foreground/75">{step.description}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function DocGrid({ items }: { items: Array<{ title: string; description: string; icon?: string }> }) {
  return (
    <div className="my-6 grid gap-3 sm:grid-cols-2">
      {items.map((item, i) => (
        <div key={i} className="rounded-lg border bg-card p-4 transition-colors hover:border-foreground/20">
          <div className="mb-1.5 font-semibold text-foreground">{item.title}</div>
          <div className="text-sm leading-6 text-foreground/75">{item.description}</div>
        </div>
      ))}
    </div>
  );
}

export function DocDivider() {
  return <hr className="my-8 border-border" />;
}
