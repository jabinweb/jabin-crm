'use client';

import { FileText, Download } from 'lucide-react';
import { chatSegments } from '@/lib/messaging/mentions';
import { cn } from '@/lib/utils';
import type { Attachment } from './use-messaging';

/** Message text with @mentions and links — rendered as React nodes, never raw HTML. */
export function MessageText({ content, meId }: { content: string; meId?: string }) {
  return (
    <span className="whitespace-pre-wrap break-words">
      {chatSegments(content).map((segment, i) => {
        if (segment.type === 'mention') {
          return (
            <span
              key={i}
              className={cn(
                'rounded px-1 font-medium',
                segment.userId === meId
                  ? 'bg-amber-500/20 text-amber-800 dark:text-amber-300'
                  : 'bg-primary/10 text-primary'
              )}
            >
              @{segment.name}
            </span>
          );
        }
        if (segment.type === 'link') {
          return (
            <a
              key={i}
              href={segment.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2"
            >
              {segment.href}
            </a>
          );
        }
        return <span key={i}>{segment.text}</span>;
      })}
    </span>
  );
}

function formatSize(size?: number | null) {
  if (!size) return '';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function MessageAttachments({ attachments }: { attachments: Attachment[] }) {
  if (attachments.length === 0) return null;
  return (
    <div className="mt-1.5 flex flex-wrap gap-2">
      {attachments.map((file) =>
        file.mimeType?.startsWith('image/') ? (
          <a
            key={file.url}
            href={file.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block overflow-hidden rounded-md border bg-muted"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={file.url}
              alt={file.name}
              loading="lazy"
              className="max-h-60 max-w-[min(20rem,100%)] object-cover"
            />
          </a>
        ) : (
          <a
            key={file.url}
            href={file.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex max-w-xs items-center gap-2.5 rounded-md border bg-background px-3 py-2 text-sm transition-colors hover:bg-muted/60"
          >
            <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{file.name}</span>
              {file.size ? (
                <span className="block text-xs text-muted-foreground">{formatSize(file.size)}</span>
              ) : null}
            </span>
            <Download className="h-4 w-4 shrink-0 text-muted-foreground" />
          </a>
        )
      )}
    </div>
  );
}
