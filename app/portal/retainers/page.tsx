'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RefreshCw } from 'lucide-react';
import { SectionSkeleton } from '@/components/loading';
import { PortalFeatureGuard } from '@/components/portal/portal-feature-guard';

type PortalRetainer = {
  id: string;
  name: string;
  description: string | null;
  amount: number;
  currency: string;
  billingCycle: string;
  status: string;
  includedHours: number | null;
  nextBillAt: string | null;
  lastBilledAt: string | null;
  startDate: string;
  project: { id: string; name: string } | null;
};

function RetainersList() {
  const { data: retainers = [], isLoading } = useQuery({
    queryKey: ['portal-retainers'],
    queryFn: async () => {
      const res = await fetch('/api/portal/retainers');
      if (!res.ok) throw new Error('Failed to load retainers');
      return (await res.json()) as PortalRetainer[];
    },
  });

  if (isLoading) {
    return <SectionSkeleton lines={6} />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Retainers</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Recurring plans linked to your account.
        </p>
      </div>

      {retainers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <RefreshCw className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="font-medium">No retainers yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              When your provider sets up a care plan or retainer, it will appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {retainers.map((r) => (
            <Card key={r.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{r.name}</CardTitle>
                  <Badge variant="secondary">{r.status}</Badge>
                </div>
                {r.description ? (
                  <p className="text-sm text-muted-foreground line-clamp-2">{r.description}</p>
                ) : null}
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="font-medium">
                  {r.currency} {r.amount.toLocaleString()} / {r.billingCycle.toLowerCase()}
                </p>
                {r.includedHours != null ? (
                  <p className="text-muted-foreground">{r.includedHours}h included per cycle</p>
                ) : null}
                {r.nextBillAt ? (
                  <p className="text-xs text-muted-foreground">
                    Next bill: {new Date(r.nextBillAt).toLocaleDateString()}
                  </p>
                ) : null}
                {r.project ? (
                  <Link
                    href={`/portal/projects/${r.project.id}`}
                    className="text-xs text-primary underline-offset-2 hover:underline"
                  >
                    Project: {r.project.name}
                  </Link>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PortalRetainersPage() {
  return (
    <PortalFeatureGuard
      feature="customerPortal"
      title="Retainers not available"
      description="Your provider has not enabled the customer portal."
    >
      <RetainersList />
    </PortalFeatureGuard>
  );
}
