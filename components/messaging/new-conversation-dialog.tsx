'use client';

import { useEffect, useState } from 'react';
import { Loader2, Megaphone, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PeoplePicker } from './people-picker';
import { useCreateConversation, type ConversationType, type Person } from './use-messaging';

const COPY: Record<ConversationType, { title: string; description: string }> = {
  DIRECT: { title: 'New direct message', description: 'Pick a teammate to talk to one to one.' },
  GROUP: { title: 'New group', description: 'A shared space where every member can post.' },
  BROADCAST: {
    title: 'New broadcast',
    description: 'Announcements: only you and the admins you choose can post. Members read and react.',
  },
};

export function NewConversationDialog({
  kind,
  people,
  meId,
  isWorkspaceAdmin,
  onClose,
  onCreated,
}: {
  kind: ConversationType | null;
  people: Person[];
  meId?: string;
  isWorkspaceAdmin: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const create = useCreateConversation();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [everyone, setEveryone] = useState(false);

  useEffect(() => {
    if (!kind) return;
    setName('');
    setDescription('');
    setSelected([]);
    setEveryone(kind === 'BROADCAST' && isWorkspaceAdmin);
  }, [kind, isWorkspaceAdmin]);

  if (!kind) return null;
  const copy = COPY[kind];
  const others = people.filter((p) => p.id !== meId);

  const submit = async (directUserId?: string) => {
    const payload =
      kind === 'DIRECT'
        ? { type: 'DIRECT', userId: directUserId }
        : {
            type: kind,
            name: name.trim(),
            description: description.trim() || undefined,
            memberIds: everyone ? [] : selected,
            includesEveryone: everyone,
          };
    const result = await create.mutateAsync(payload).catch(() => null);
    if (result) {
      onCreated(result.id);
      onClose();
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {kind === 'BROADCAST' ? <Megaphone className="h-5 w-5" /> : kind === 'GROUP' ? <Users className="h-5 w-5" /> : null}
            {copy.title}
          </DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>

        {kind === 'DIRECT' ? (
          <PeoplePicker
            people={others}
            selected={[]}
            multiple={false}
            onToggle={(id) => void submit(id)}
          />
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="conversation-name">Name</Label>
              <Input
                id="conversation-name"
                autoFocus
                value={name}
                maxLength={80}
                onChange={(e) => setName(e.target.value)}
                placeholder={kind === 'BROADCAST' ? 'e.g. Company announcements' : 'e.g. Runmora design'}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="conversation-description">
                Description <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="conversation-description"
                value={description}
                maxLength={300}
                rows={2}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this for?"
              />
            </div>

            {isWorkspaceAdmin ? (
              <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
                <div>
                  <Label htmlFor="conversation-everyone">Everyone in the workspace</Label>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Current and future teammates join automatically.
                  </p>
                </div>
                <Switch id="conversation-everyone" checked={everyone} onCheckedChange={setEveryone} />
              </div>
            ) : null}

            {!everyone ? (
              <div className="space-y-1.5">
                <Label>Members {selected.length ? <span className="font-normal text-muted-foreground">· {selected.length} selected</span> : null}</Label>
                <PeoplePicker
                  people={others}
                  selected={selected}
                  onToggle={(id) =>
                    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
                  }
                />
              </div>
            ) : null}
          </div>
        )}

        {kind !== 'DIRECT' ? (
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              disabled={!name.trim() || create.isPending || (!everyone && selected.length === 0)}
              onClick={() => void submit()}
            >
              {create.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              Create
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
