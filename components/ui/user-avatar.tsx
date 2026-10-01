'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { avatarSrc, avatarTint, initialsOf } from '@/lib/avatar';
import { cn } from '@/lib/utils';

export type AvatarPerson = {
  id?: string | null;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  avatar?: string | null;
};

const SIZES = {
  xs: { box: 'h-5 w-5', text: 'text-[9px]', px: 20 },
  sm: { box: 'h-7 w-7', text: 'text-[10px]', px: 28 },
  md: { box: 'h-8 w-8', text: 'text-xs', px: 32 },
  lg: { box: 'h-10 w-10', text: 'text-sm', px: 40 },
  xl: { box: 'h-14 w-14', text: 'text-base', px: 56 },
} as const;

/**
 * The one avatar for people across the CRM: their image, else Gravatar, else
 * tinted initials. Pass `online` to show a presence dot.
 */
export function UserAvatar({
  person,
  size = 'md',
  className,
  online,
}: {
  person: AvatarPerson | null | undefined;
  size?: keyof typeof SIZES;
  className?: string;
  online?: boolean;
}) {
  const s = SIZES[size];
  const label = person?.name || person?.email || 'Unknown';
  return (
    <span className={cn('relative inline-flex shrink-0', className)}>
      <Avatar className={cn(s.box, 'rounded-full')}>
        <AvatarImage
          src={avatarSrc(person, s.px)}
          alt={label}
          className="object-cover"
          referrerPolicy="no-referrer"
        />
        <AvatarFallback
          className={cn(
            'rounded-full font-medium',
            s.text,
            avatarTint(person?.id || person?.email || person?.name)
          )}
        >
          {initialsOf(person?.name, person?.email)}
        </AvatarFallback>
      </Avatar>
      {online !== undefined ? (
        <span
          aria-label={online ? 'Online' : 'Offline'}
          className={cn(
            'absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full ring-2 ring-background',
            online ? 'bg-emerald-500' : 'bg-muted-foreground/40'
          )}
        />
      ) : null}
    </span>
  );
}

/** Overlapping stack of avatars with a "+N" overflow chip. */
export function AvatarStack({
  people,
  max = 4,
  size = 'sm',
  className,
}: {
  people: AvatarPerson[];
  max?: number;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  return (
    <span className={cn('inline-flex items-center -space-x-2', className)}>
      {shown.map((person, i) => (
        <UserAvatar
          key={person.id || person.email || i}
          person={person}
          size={size}
          className="rounded-full ring-2 ring-background"
        />
      ))}
      {extra > 0 ? (
        <span
          className={cn(
            'inline-flex items-center justify-center rounded-full bg-muted font-medium ring-2 ring-background',
            SIZES[size].box,
            SIZES[size].text
          )}
        >
          +{extra}
        </span>
      ) : null}
    </span>
  );
}
