'use client';

import React, { useState } from 'react';
import { Check, Copy, AlertCircle, Info, CheckCircle2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export function DocParagraph({ children }: { children: React.ReactNode }) {
  return <p className="text-[15px] leading-7 text-muted-foreground">{children}</p>;
}

export function DocHeading({ level, children }: { level: 1 | 2 | 3 | 4; children: React.ReactNode }) {
  const classes = {
    1: 'text-4xl font-bold tracking-tight mt-12 mb-6',
    2: 'text-3xl font-semibold tracking-tight mt-10 mb-5',
    3: 'text-2xl font-semibold mt-8 mb-4',
    4: 'text-xl font-semibold mt-6 mb-3',
  };

  const Component = `h${level}` as React.ElementType;
  
  return <Component className={classes[level]}>{children}</Component>;
}

export function DocList({ items, ordered = false }: { items: string[]; ordered?: boolean }) {
  const Component = ordered ? 'ol' : 'ul';
  return (
    <Component className={cn('space-y-2 text-[15px]', ordered ? 'list-decimal' : 'list-disc', 'ml-6')}>
      {items.map((item, i) => (
        <li key={i} className="text-muted-foreground leading-7">{item}</li>
      ))}
    </Component>
  );
}

export function DocCodeBlock({ code, language, title }: { code: string; language: string; title?: string }) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-6 rounded-none border bg-muted/50">
      {title && (
        <div className="flex items-center justify-between border-b px-4 py-2">
          <span className="text-sm font-medium">{title}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={copyToClipboard}
            className="h-7 text-xs"
          >
            {copied ? (
              <>
                <Check className="mr-1 h-3 w-3" />
                Copied
              </>
            ) : (
              <>
                <Copy className="mr-1 h-3 w-3" />
                Copy
              </>
            )}
          </Button>
        </div>
      )}
      <pre className="overflow-x-auto p-4">
        <code className={`language-${language} text-sm`}>{code}</code>
      </pre>
    </div>
  );
}

export function DocAlert({ type, title, message }: { type: 'info' | 'success' | 'warning' | 'error'; title?: string; message: string }) {
  const config = {
    info: {
      icon: Info,
      bg: 'bg-blue-50 dark:bg-blue-950/30',
      border: 'border-blue-200 dark:border-blue-900',
      iconColor: 'text-blue-600 dark:text-blue-400',
      titleColor: 'text-blue-900 dark:text-blue-100',
    },
    success: {
      icon: CheckCircle2,
      bg: 'bg-green-50 dark:bg-green-950/30',
      border: 'border-green-200 dark:border-green-900',
      iconColor: 'text-green-600 dark:text-green-400',
      titleColor: 'text-green-900 dark:text-green-100',
    },
    warning: {
      icon: AlertTriangle,
      bg: 'bg-orange-50 dark:bg-orange-950/30',
      border: 'border-orange-200 dark:border-orange-900',
      iconColor: 'text-orange-600 dark:text-orange-400',
      titleColor: 'text-orange-900 dark:text-orange-100',
    },
    error: {
      icon: AlertCircle,
      bg: 'bg-red-50 dark:bg-red-950/30',
      border: 'border-red-200 dark:border-red-900',
      iconColor: 'text-red-600 dark:text-red-400',
      titleColor: 'text-red-900 dark:text-red-100',
    },
  };

  const { icon: Icon, bg, border, iconColor, titleColor } = config[type];

  return (
    <div className={cn('my-6 flex gap-3 rounded-none border p-4', bg, border)}>
      <Icon className={cn('h-5 w-5 shrink-0 mt-0.5', iconColor)} />
      <div className="flex-1">
        {title && <div className={cn('font-semibold mb-1', titleColor)}>{title}</div>}
        <div className="text-sm text-muted-foreground">{message}</div>
      </div>
    </div>
  );
}

export function DocTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="my-6 overflow-hidden rounded-none border">
      <table className="w-full text-sm">
        <thead className="bg-muted">
          <tr>
            {headers.map((header, i) => (
              <th key={i} className="px-4 py-3 text-left font-semibold">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-muted/50">
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-3 text-muted-foreground">
                  {cell}
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
    <div className="my-6 space-y-4">
      {steps.map((step, i) => (
        <div key={i} className="flex gap-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-none bg-primary text-sm font-bold text-primary-foreground">
            {i + 1}
          </div>
          <div className="flex-1 pt-1">
            <div className="font-semibold mb-1">{step.title}</div>
            <div className="text-sm text-muted-foreground">{step.description}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function DocGrid({ items }: { items: Array<{ title: string; description: string; icon?: string }> }) {
  return (
    <div className="my-6 grid gap-4 md:grid-cols-2">
      {items.map((item, i) => (
        <div key={i} className="rounded-none border p-4 hover:border-primary/50 transition-colors">
          <div className="font-semibold mb-2">{item.title}</div>
          <div className="text-sm text-muted-foreground">{item.description}</div>
        </div>
      ))}
    </div>
  );
}

export function DocDivider() {
  return <hr className="my-8 border-border" />;
}

