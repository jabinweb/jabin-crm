'use client';

import { AvatarStack } from '@/components/ui/user-avatar';
import { cn } from '@/lib/utils';
import type { PresencePerson } from '@/lib/presence';

function nameOf(p: PresencePerson) {
  return p.name?.trim() || p.email;
}

/**
 * "Someone is on this right now" marker for list rows and cards: a pulsing green dot
 * plus the teammates' avatars. Renders nothing when nobody else is there.
 */
export function LiveViewers({
  people,
  verb = 'viewing',
  className,
  showLabel = false,
}: {
  people: Array<PresencePerson & { typing?: boolean }>;
  verb?: string;
  className?: string;
  /** Show "Jason is viewing" text next to the avatars. */
  showLabel?: boolean;
}) {
  if (people.length === 0) return null;
  const typing = people.some((p) => p.typing);
  const names = people.map(nameOf);
  const who =
    names.length === 1
      ? names[0]
      : names.length === 2
        ? `${names[0]} and ${names[1]}`
        : `${names[0]} and ${names.length - 1} others`;
  const label = `${who} ${names.length === 1 ? 'is' : 'are'} ${typing ? 'replying' : verb} now`;

  return (
    <span
      className={cn('inline-flex shrink-0 items-center gap-1.5', className)}
      title={label}
      aria-label={label}
      role="status"
    >
      <span className="relative flex h-2 w-2" aria-hidden>
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      <AvatarStack people={people} max={3} size="xs" />
      {showLabel ? (
        <span className="truncate text-xs text-emerald-700 dark:text-emerald-400">{label}</span>
      ) : null}
    </span>
  );
}
