'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import {
  Bell,
  BellOff,
  Crown,
  LogOut,
  Mail,
  MoreHorizontal,
  ShieldCheck,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { UserAvatar } from '@/components/ui/user-avatar';
import { confirmAction } from '@/lib/confirm-action';
import { PeoplePicker } from './people-picker';
import {
  displayName,
  useConversationAdmin,
  type ConversationDetail,
  type Person,
} from './use-messaging';

const ROLE_LABEL: Record<string, string> = { OWNER: 'Owner', ADMIN: 'Admin' };

export function ConversationDetails({
  conversation,
  people,
  meId,
  onlineIds,
  onClose,
  onLeft,
}: {
  conversation: ConversationDetail;
  people: Person[];
  meId?: string;
  onlineIds: Set<string>;
  onClose: () => void;
  /** After leaving or deleting */
  onLeft: () => void;
}) {
  const admin = useConversationAdmin(conversation.id);
  const [name, setName] = useState(conversation.name ?? '');
  const [description, setDescription] = useState(conversation.description ?? '');
  const [adding, setAdding] = useState(false);
  const [toAdd, setToAdd] = useState<string[]>([]);

  useEffect(() => {
    setName(conversation.name ?? '');
    setDescription(conversation.description ?? '');
  }, [conversation.id, conversation.name, conversation.description]);

  const isDirect = conversation.type === 'DIRECT';
  const memberIds = conversation.members.map((m) => m.id);
  const detailsDirty =
    name.trim() !== (conversation.name ?? '') || description.trim() !== (conversation.description ?? '');

  return (
    <aside className="flex h-full min-h-0 flex-col" aria-label="Conversation details">
      <div className="flex h-14 shrink-0 items-center justify-between border-b px-4">
        <h2 className="text-sm font-semibold">{isDirect ? 'Profile' : 'Details'}</h2>
        <Button variant="ghost" size="icon" className="h-10 w-10 lg:h-8 lg:w-8" aria-label="Close details" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4">
        {isDirect && conversation.otherUser ? (
          <div className="flex flex-col items-center text-center">
            <UserAvatar person={conversation.otherUser} size="xl" online={onlineIds.has(conversation.otherUser.id)} />
            <p className="mt-3 font-semibold">{displayName(conversation.otherUser)}</p>
            <a
              href={`mailto:${conversation.otherUser.email}`}
              className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <Mail className="h-3 w-3" />
              {conversation.otherUser.email}
            </a>
          </div>
        ) : (
          <section className="space-y-3">
            {conversation.canManage ? (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="details-name">Name</Label>
                  <Input id="details-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="details-description">Description</Label>
                  <Textarea
                    id="details-description"
                    rows={2}
                    maxLength={300}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What is this for?"
                  />
                </div>
                {detailsDirty ? (
                  <Button
                    size="sm"
                    disabled={!name.trim()}
                    onClick={() => void admin.update({ name: name.trim(), description: description.trim() })}
                  >
                    Save changes
                  </Button>
                ) : null}
              </>
            ) : (
              <div>
                <p className="font-semibold">{conversation.name}</p>
                {conversation.description ? (
                  <p className="mt-1 text-sm text-muted-foreground">{conversation.description}</p>
                ) : null}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              {conversation.type === 'BROADCAST' ? 'Broadcast' : 'Group'} · created{' '}
              {format(new Date(conversation.createdAt), 'd MMM yyyy')}
              {conversation.includesEveryone ? ' · everyone in the workspace' : ''}
            </p>
          </section>
        )}

        <section>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2"
            onClick={() => void admin.update({ muted: !conversation.muted })}
          >
            {conversation.muted ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
            {conversation.muted ? 'Unmute notifications' : 'Mute notifications'}
          </Button>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {conversation.muted
              ? 'You only hear about @mentions here.'
              : isDirect
                ? 'You get a notification for new messages.'
                : conversation.type === 'BROADCAST'
                  ? 'You get a notification for each announcement and @mention.'
                  : 'You get a notification when someone @mentions you.'}
          </p>
        </section>

        {!isDirect ? (
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Members · {conversation.members.length}
              </h3>
              {conversation.canManage && !conversation.includesEveryone ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 text-xs"
                  onClick={() => {
                    setToAdd([]);
                    setAdding(true);
                  }}
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Add
                </Button>
              ) : null}
            </div>
            <ul className="space-y-0.5">
              {conversation.members.map((member) => (
                <li key={member.id} className="group flex items-center gap-2.5 rounded-md px-1.5 py-1.5 hover:bg-muted/50">
                  <UserAvatar person={member} size="sm" online={onlineIds.has(member.id)} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">
                      {displayName(member)}
                      {member.id === meId ? <span className="text-muted-foreground"> (you)</span> : null}
                    </span>
                  </span>
                  {ROLE_LABEL[member.role] ? (
                    <Badge variant="secondary" className="h-5 gap-1 px-1.5 text-[10px] font-medium">
                      {member.role === 'OWNER' ? <Crown className="h-3 w-3" /> : <ShieldCheck className="h-3 w-3" />}
                      {ROLE_LABEL[member.role]}
                    </Badge>
                  ) : null}
                  {conversation.canManage && member.id !== meId && member.role !== 'OWNER' ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          aria-label={`Manage ${displayName(member)}`}
                          className="rounded p-1 text-muted-foreground opacity-0 hover:bg-muted hover:text-foreground focus:opacity-100 group-hover:opacity-100"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onSelect={() => void admin.setRole(member.id, member.role === 'ADMIN' ? 'MEMBER' : 'ADMIN')}
                        >
                          <ShieldCheck className="mr-2 h-4 w-4" />
                          {member.role === 'ADMIN' ? 'Remove admin' : 'Make admin'}
                        </DropdownMenuItem>
                        {!conversation.includesEveryone ? (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onSelect={() => void admin.removeMember(member.id)}
                            >
                              <X className="mr-2 h-4 w-4" />
                              Remove from {conversation.type === 'BROADCAST' ? 'broadcast' : 'group'}
                            </DropdownMenuItem>
                          </>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {!isDirect ? (
          <section className="space-y-2 border-t pt-4">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2 text-muted-foreground"
              onClick={async () => {
                const ok = await confirmAction({
                  title: `Leave ${conversation.name}?`,
                  description: conversation.includesEveryone
                    ? 'This includes everyone in the workspace, so you will be added back the next time you open Messages.'
                    : 'You will stop receiving its messages. Someone with admin rights can add you back.',
                  confirmLabel: 'Leave',
                });
                if (ok && (await admin.leave())) onLeft();
              }}
            >
              <LogOut className="h-4 w-4" />
              Leave
            </Button>
            {conversation.myRole === 'OWNER' ? (
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2 text-destructive hover:text-destructive"
                onClick={async () => {
                  const ok = await confirmAction({
                    title: `Delete ${conversation.name}?`,
                    description: 'All messages are deleted for everyone. This cannot be undone.',
                    confirmLabel: 'Delete',
                    variant: 'destructive',
                  });
                  if (ok && (await admin.destroy())) onLeft();
                }}
              >
                <Trash2 className="h-4 w-4" />
                Delete {conversation.type === 'BROADCAST' ? 'broadcast' : 'group'}
              </Button>
            ) : null}
          </section>
        ) : null}
      </div>

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add people to {conversation.name}</DialogTitle>
          </DialogHeader>
          <PeoplePicker
            people={people}
            exclude={memberIds}
            selected={toAdd}
            emptyText="Everyone in the workspace is already here."
            onToggle={(id) => setToAdd((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button
              disabled={toAdd.length === 0}
              onClick={async () => {
                if (await admin.addMembers(toAdd)) setAdding(false);
              }}
            >
              Add {toAdd.length || ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </aside>
  );
}
