'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Copy, Link2, Loader2, QrCode, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';

type ServiceLinkCardProps = {
  /** customer | equipment */
  scope: 'customer' | 'equipment';
  id: string;
  title?: string;
  description?: string;
};

export function ServiceLinkCard({
  scope,
  id,
  title = 'One-click service link',
  description = 'Share this link or QR code so clients can raise a ticket without WhatsApp or login.',
}: ServiceLinkCardProps) {
  const { workspaceFetch } = useWorkspacePaths();
  const [rotating, setRotating] = useState(false);

  const endpoint =
    scope === 'customer'
      ? `/api/customers/${id}/service-link`
      : `/api/inventory/installations/${id}/service-link`;

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['service-link', scope, id],
    queryFn: async () => {
      const res = await workspaceFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rotate: false }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Failed to load link');
      return body as { url: string; token: string; organizationName?: string };
    },
  });

  const copyLink = async () => {
    if (!data?.url) return;
    await navigator.clipboard.writeText(data.url);
    toast.success('Link copied');
  };

  const rotate = async () => {
    setRotating(true);
    try {
      const res = await workspaceFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rotate: true }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Failed to rotate');
      await refetch();
      toast.success('New link created — old QR codes stop working');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to rotate link');
    } finally {
      setRotating(false);
    }
  };

  const qrSrc = data?.url
    ? `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(data.url)}`
    : null;

  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <QrCode className="h-4 w-4" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : data?.url ? (
          <>
            <div className="flex flex-col sm:flex-row gap-4 items-start">
              {qrSrc && (
                <div className="rounded-lg border bg-white p-2 shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrSrc} alt="Service request QR code" width={180} height={180} />
                </div>
              )}
              <div className="flex-1 space-y-3 w-full min-w-0">
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">Public link</p>
                  <div className="flex gap-2">
                    <Input readOnly value={data.url} className="text-xs font-mono" />
                    <Button type="button" variant="outline" size="icon" onClick={copyLink}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" onClick={copyLink}>
                    <Link2 className="mr-1.5 h-3.5 w-3.5" />
                    Copy link
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={rotate}
                    disabled={rotating || isFetching}
                  >
                    {rotating ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Rotate link
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Print the QR on the machine or send the link by SMS/email. No client login needed.
                </p>
              </div>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Could not load service link.</p>
        )}
      </CardContent>
    </Card>
  );
}
