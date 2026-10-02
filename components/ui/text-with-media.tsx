import { Fragment } from 'react';
import { cn } from '@/lib/utils';

/** `![alt](url)` image references inserted by useImagePaste, plus bare links. */
const IMAGE_RE = /!\[([^\]]*)\]\(((?:https?:\/\/|\/(?!\/))[^\s)]+)\)/g;
const LINK_RE = /(https?:\/\/[^\s<]+)/g;

function linkify(text: string, keyPrefix: string) {
  return text.split(LINK_RE).map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a
        key={`${keyPrefix}-${i}`}
        href={part}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary underline underline-offset-2 break-all"
      >
        {part}
      </a>
    ) : (
      <Fragment key={`${keyPrefix}-${i}`}>{part}</Fragment>
    )
  );
}

/**
 * Plain-text comments with pasted images shown inline (click opens full size) and
 * links made clickable. Text stays text — nothing is rendered as HTML.
 */
export function TextWithMedia({ text, className }: { text: string | null | undefined; className?: string }) {
  if (!text) return null;
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  IMAGE_RE.lastIndex = 0;
  while ((match = IMAGE_RE.exec(text))) {
    if (match.index > last) nodes.push(...linkify(text.slice(last, match.index), `t${last}`));
    const [, alt, url] = match;
    nodes.push(
      <a key={`img${match.index}`} href={url} target="_blank" rel="noopener noreferrer" className="my-1.5 block w-fit">
        {/* eslint-disable-next-line @next/next/no-img-element -- user uploads on the file server */}
        <img src={url} alt={alt || 'Image'} loading="lazy" className="max-h-80 max-w-full rounded-md border object-contain" />
      </a>
    );
    last = match.index + match[0].length;
  }
  if (last < text.length) nodes.push(...linkify(text.slice(last), `t${last}`));
  return <div className={cn('whitespace-pre-wrap break-words text-sm', className)}>{nodes}</div>;
}
