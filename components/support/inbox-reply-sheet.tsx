'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ExternalLink, Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import type { UnifiedInboxItem } from '@/lib/support/unified-inbox';

type Props = {
  item: UnifiedInboxItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function InboxReplySheet({ item, open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const { path, workspaceFetch } = useWorkspacePaths();
  const [comment, setComment] = useState('');
  const [isInternal, setIsInternal] = useState(false);

  const ticketId = item?.ticketId ?? null;

  const { data: ticket, isLoading } = useQuery({
    queryKey: ['inbox-ticket', ticketId],
    enabled: open && !!ticketId,
    queryFn: async () => {
      const res = await workspaceFetch(`/api/tickets/${ticketId}`);
      if (!res.ok) throw new Error('Failed to load ticket');
      return res.json();
    },
  });

  const replyMutation = useMutation({
    mutationFn: async () => {
      if (!ticketId || !comment.trim()) {
        throw new Error('Reply text is required');
      }
      const res = await workspaceFetch(`/api/tickets/${ticketId}/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: comment.trim(), isInternal }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Failed to send reply');
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success(isInternal ? 'Internal note added' : 'Reply sent');
      setComment('');
      setIsInternal(false);
      queryClient.invalidateQueries({ queryKey: ['unified-inbox'] });
      queryClient.invalidateQueries({ queryKey: ['inbox-ticket', ticketId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setComment('');
      setIsInternal(false);
    }
    onOpenChange(next);
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="w-full sm:max-w-lg flex flex-col">
        <SheetHeader>
          <SheetTitle className="pr-8 line-clamp-2">
            {item?.subject ?? 'Conversation'}
          </SheetTitle>
          <SheetDescription>
            {item?.customerName ?? 'Customer'} · {item?.channel ?? '—'}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-wrap gap-2 py-2">
          {item?.status ? <Badge variant="outline">{item.status}</Badge> : null}
          {item?.priority ? <Badge variant="secondary">{item.priority}</Badge> : null}
          {item?.agentName ? (
            <Badge variant="outline">Assigned: {item.agentName}</Badge>
          ) : null}
        </div>

        {item?.preview ? (
          <p className="text-sm text-muted-foreground border rounded-md p-3 bg-muted/40">
            {item.preview}
          </p>
        ) : null}

        {!ticketId ? (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
            Live chat replies open in the messaging module. Select a ticket to reply here.
          </div>
        ) : isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex-1 flex flex-col gap-4 min-h-0">
            {ticket?.description ? (
              <div className="text-sm max-h-32 overflow-y-auto rounded-md border p-3">
                {ticket.description}
              </div>
            ) : null}

            <div className="space-y-2 flex-1 flex flex-col">
              <Label htmlFor="inbox-reply">Your reply</Label>
              <Textarea
                id="inbox-reply"
                placeholder="Write a reply to the customer…"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="min-h-[120px] flex-1 resize-none"
              />
              <div className="flex items-center gap-2">
                <Checkbox
                  id="inbox-internal"
                  checked={isInternal}
                  onCheckedChange={(v) => setIsInternal(v === true)}
                />
                <Label htmlFor="inbox-internal" className="text-sm font-normal cursor-pointer">
                  Internal note (not visible to customer)
                </Label>
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-4 border-t mt-auto">
          {ticketId ? (
            <>
              <Button
                className="flex-1"
                onClick={() => replyMutation.mutate()}
                disabled={!comment.trim() || replyMutation.isPending}
              >
                {replyMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Send reply
              </Button>
              <Button variant="outline" asChild>
                <Link href={path(`/dashboard/tickets/${ticketId}`)}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Full ticket
                </Link>
              </Button>
            </>
          ) : (
            <Button variant="outline" className="w-full" onClick={() => handleOpenChange(false)}>
              Close
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
