'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileUpload } from '@/components/ui/file-upload';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { toast } from 'sonner';
import { Camera } from 'lucide-react';

type Attachment = {
  id: string;
  url: string;
  fileName: string | null;
  contentType: string | null;
  createdAt: string;
};

export function TicketPhotoEvidence({ ticketId }: { ticketId: string }) {
  const { slug, workspaceFetch } = useWorkspacePaths();
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ['ticket-attachments', slug, ticketId],
    queryFn: async () => {
      const res = await workspaceFetch(`/api/tickets/${ticketId}/attachments`);
      if (!res.ok) throw new Error('Failed to load photos');
      return res.json() as Promise<{ attachments: Attachment[] }>;
    },
    enabled: !!ticketId && !!slug,
  });

  const attachments = data?.attachments ?? [];

  return (
    <Card className="shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Camera className="h-4 w-4" />
          Photo evidence
        </CardTitle>
        <CardDescription>
          Field photos attached to this ticket. May be required before resolve.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {attachments.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {attachments.map((a) => (
              <a
                key={a.id}
                href={a.url}
                target="_blank"
                rel="noreferrer"
                className="block rounded-md border overflow-hidden bg-muted/40 aspect-square"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={a.url}
                  alt={a.fileName || 'Evidence'}
                  className="h-full w-full object-cover"
                />
              </a>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No photos yet.</p>
        )}
        <FileUpload
          accept="image/*"
          label="Upload photo"
          folder="ticket-evidence"
          onUploadComplete={async (file) => {
            try {
              const res = await workspaceFetch(`/api/tickets/${ticketId}/attachments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  url: file.url,
                  fileName: file.filename,
                  contentType: file.type,
                }),
              });
              if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error || 'Failed to save attachment');
              }
              toast.success('Photo attached');
              queryClient.invalidateQueries({
                queryKey: ['ticket-attachments', slug, ticketId],
              });
              queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] });
            } catch (e) {
              toast.error(e instanceof Error ? e.message : 'Failed to attach photo');
            }
          }}
        />
      </CardContent>
    </Card>
  );
}
