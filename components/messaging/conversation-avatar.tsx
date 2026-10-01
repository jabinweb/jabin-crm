'use client';

import { Megaphone, Users } from 'lucide-react';
import { UserAvatar } from '@/components/ui/user-avatar';
import { avatarTint } from '@/lib/avatar';
import { cn } from '@/lib/utils';
import type { ConversationType, Person } from './use-messaging';

/** DM → the other person's avatar; group → tinted initials; broadcast → megaphone. */
export function ConversationAvatar({
  conversation,
  size = 'lg',
  online,
}: {
  conversation: { id: string; type: ConversationType; name: string | null; otherUser: Person | null };
  size?: 'md' | 'lg';
  online?: boolean;
}) {
  if (conversation.type === 'DIRECT') {
    return <UserAvatar person={conversation.otherUser} size={size} online={online} />;
  }
  const box = size === 'lg' ? 'h-10 w-10' : 'h-8 w-8';
  if (conversation.type === 'BROADCAST') {
    return (
      <span className={cn('inline-flex shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-300', box)}>
        <Megaphone className="h-4 w-4" />
      </span>
    );
  }
  const initials = (conversation.name || '#')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-lg text-xs font-semibold',
        box,
        avatarTint(conversation.id)
      )}
    >
      {initials || <Users className="h-4 w-4" />}
    </span>
  );
}
